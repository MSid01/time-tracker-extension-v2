import { API_URL, millisecondsToMinutes } from "./utilities.js";

// let apiURL = "http://192.168.48.1:8080/api";

function generateUniqueId() {
  return Date.now().toString() + Math.random().toString(36).substr(2);
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log(sender);
  if (request.recordTab) {
    chrome.alarms.create(
      "recordTab",
      {
        delayInMinutes: 1 / 6,
        periodInMinutes: 1 / 6,
      },
      function () {
        console.log("recording started");
      }
    );
  }
  if (request.recordTab === false) {
    clearAlarm();
  }
  if (request.timeLimit) {
    chrome.storage.local.set({
      [request.timeLimit.hostName]: request.timeLimit.timeInMS,
    });
    chrome.storage.local.get([request.timeLimit.hostName], (res) => {
      console.log("Alarm set for ", request.timeLimit.hostName);
    });
  }
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === "recordTab") {
    captureVisibleTab();
  } else if (alarm.name === "timeOutAlarm") {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs.length > 0) {
        const activeTab = tabs[0];
        const hostName = new URL(activeTab.url).host;
        chrome.storage.local.remove(hostName, function () {
          console.log("timelimit key removed");
        });
        showTimeOutNotification(hostName);
      }
    });
  }
});

function setUserIdCookie(userId) {
  const cookieDetails = {
    url: API_URL, // Replace with the domain you want to set the cookie for
    name: "userId",
    value: userId,
    path: "/",
    // domain:'192.168.48.1:8080',
    expirationDate: Date.now() + 365 * 24 * 60 * 60 * 1000, // Set a long expiration date (e.g., 1 year)
  };

  chrome.cookies.set(cookieDetails, (cookie) => {
    if (chrome.runtime.lastError) {
      console.error('Error setting "userId" cookie:', chrome.runtime.lastError);
    } else {
      console.log('"userId" cookie set successfully:', cookie);
    }
  });
}

chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === "install") {
    const uniqueUserId = generateUniqueId();

    chrome.storage.local.set(
      {
        startTime: null,
        currentHostname: null,
        snapshots: [],
        uniqueUserId,
        screenshotsObj: {},
      },
      function () {
        console.log("values set successfully");
      }
    );

    setUserIdCookie(uniqueUserId);
  }
});

function clearAlarm() {
  chrome.alarms.clear("recordTab", function (wasCleared) {
    if (wasCleared) {
      console.log("Alarm 'recordTab' cleared.");
    } else {
      console.log("No alarm with the name 'recordTab' found.");
    }
  });
  showAlarmNotification("recordTab");
}

function captureVisibleTab() {
  chrome.tabs.captureVisibleTab(
    null,
    { quality: 4 },
    function (screenshotDataUrl) {
      console.log(screenshotDataUrl);
      var hostName;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          const activeTab = tabs[0];
          hostName = new URL(activeTab.url).host;
        }
      });
      if (chrome.runtime.lastError) {
        console.error("Capture error:", chrome.runtime.lastError);

        clearAlarm();
        return;
      }

      chrome.storage.local.get("screenshotsObj", function (res) {
        console.log(res);
        let ssObj = res.screenshotsObj;

        if (!ssObj[hostName]) {
          ssObj[hostName] = [];
        } else if (ssObj[hostName].length == 10) {
          ssObj[hostName].shift();
        }
        ssObj[hostName].push(screenshotDataUrl);
        console.log("Afrer push", ssObj);
        chrome.storage.local.set({ screenshotsObj: ssObj });
      });
    }
  );
}

function startTracking(url, changeInfo) {
  // if(url === currentHostname) return;
  // chrome.storage.session.get("timeout",function(res){
  //   clearTimeout(res.timeout);
  // })

  chrome.alarms.clear("timeOutAlarm", function (wasCleared) {
    if (wasCleared) {
      console.log("alarm cleared");
    } else {
      console.log("not cleared");
    }
  });

  stopTracking();
  if (changeInfo && changeInfo.status !== "complete") return;

  if (!url || url.startsWith("chrome://")) {
    chrome.storage.local.set({
      startTime: null,
      currentHostname: null,
    });
    return;
  }

  const currentHostname = new URL(url).host;
  chrome.storage.local.set({
    currentHostname: currentHostname,
    startTime: Date.now(),
  });

  chrome.storage.local.get(currentHostname, function (res) {
    if (res[currentHostname]) {
      chrome.alarms.create(
        "timeOutAlarm",
        {
          delayInMinutes: millisecondsToMinutes(res[currentHostname]),
        },
        function () {
          console.log("Alarm set");
        }
      );
    }
    // var timeLimitTimeOut = setTimeout(()=>{
    //   showNotification(currentHostname);
    // },res[currentHostname]);

    // chrome.storage.session.set({"timeout":timeLimitTimeOut});
  });
}

function showAlarmNotification(notificationID) {
  chrome.notifications.create(notificationID, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Capturing stopped",
    message: `Tab capturing stopped`,
    priority: 2,
    eventTime: Date.now(),
  });
}

function showTimeOutNotification(notificationID) {
  chrome.notifications.create(`timeoutFor${notificationID}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Time Up",
    message: `You have exhausted limit for ${notificationID}`,
    priority: 2,
    buttons: [{ title: "Add 10 minutes more" }],
    eventTime: Date.now(),
  });
}

chrome.notifications.onButtonClicked.addListener(function (
  notificationId,
  buttonIndex
) {
  if (notificationId.startsWith("timeoutFor")) {
    chrome.storage.local.set({
      [notificationId.slice(10)]: 300000,
    });
  }
});

function stopTracking() {
  chrome.storage.local.get(
    ["currentHostname", "snapshots", "startTime", "uniqueUserId"],
    function ({ currentHostname, snapshots, startTime, uniqueUserId }) {
      if (snapshots.length == 10) {
        sendToApi([...snapshots]);
        snapshots = [];
      }

      const totalTimeSpent = Date.now() - startTime;

      if (totalTimeSpent < 10) return;
      if (currentHostname) {
        snapshots.push({
          domainName: currentHostname,
          startTimeStamp: startTime,
          totalTimeSpent,
          userId: uniqueUserId,
        });

        console.log("hos", currentHostname);
        chrome.storage.local.get(currentHostname, function (res) {
          const timeLimit = res[currentHostname];
          const timeRemaining = timeLimit - totalTimeSpent;
          if (timeLimit) {
            console.log("current Time limit", timeLimit);
            chrome.storage.local.set({ [currentHostname]: timeRemaining });
          }
        });
        console.log(snapshots);
        chrome.storage.local.set({ snapshots });
      }
    }
  );
}

chrome.tabs.onActivated.addListener(function ({ tabId, windowId }) {
  chrome.tabs.get(tabId, function (tab) {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    startTracking(tab.url);
  });
});

//when url changes
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status === "complete") startTracking(tab.url, changeInfo);
});

//on highlighted
// chrome.tabs.onHighlighted.addListener(
//   function({tabIds, windowId}){
//     console.log("on highlighted", tabIds, windowId);
//   }
// )

// chrome.tabs.onCreated.addListener(
//   function(tab) {
//     console.log("on created", tab);
//   }
// )

chrome.windows.onFocusChanged.addListener(function (windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    startTracking("");
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const activeTab = tabs[0];
        const tabUrl = activeTab.url;
        // Do something with the tabUrl, e.g., send it to a popup script
        startTracking(tabUrl);
      }
    });
  }
});

function sendToApi(data) {
  console.log("data received here", data);
  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  };

  fetch(`${API_URL}/user_sessions`, requestOptions)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      console.log("Response from the server:", data.message);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

// chrome.tabs.onRemoved.addListener(function(){
//   chrome.storage.local.get(["snapshots","currentHostname","startTime","uniqueUserId"], res=>{
//     const tempSnapshotsList = res.snapshots
//     tempSnapshotsList.push({
//       domainName: res.currentHostname,
//       startTimeStamp: res.startTime,
//       totalTimeSpent: Date.now()-res.startTime,
//       userId: res.uniqueUserId
//     })
//     sendToApi(tempSnapshotsList);
//     chrome.storage.local.set({snapshots:[]});
//   })
// })

// window.addEventListener('unload', function () {
// Perform cleanup tasks here
// chrome.storage.local.get(["snapshots"], res=>{
//   sendToApi(res.snapshots);
//   // chrome.storage.local.set({snapshots:[]});
// })
// });
