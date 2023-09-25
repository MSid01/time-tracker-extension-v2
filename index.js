import {
  API_URL,
  millisecondsToHoursMinutes,
  timeToMilliseconds,
} from "./utilities.js";
// const API_URL = "http://192.168.48.1:8080/api";

const options = {
  method: "GET",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Credentials": true,
  },
};

var ctx = document.getElementById("hourly-chart");

async function fetchHourlyUserSessionsWithinDayForDomain(
  domainName,
  startTimeOfDay
) {
  const hourlyUserSessionsList = await fetch(
    `${API_URL}/user_sessions_hourly/${domainName}?start_time_of_day=${startTimeOfDay}`,
    options
  ).then((res) => {
    if (!res.ok) throw new Error("failed to fetch the resources");
    return res.json();
  });
  return hourlyUserSessionsList;
}

async function fetchHourlyUserSessionsWithinDay(startTimeOfDay) {
  const res = await fetch(
    `${API_URL}/user_sessions_hourly?start_time_of_day=${startTimeOfDay}`,
    options
  );
  if (!res.ok) throw new Error("failed to fetch the resources");
  const data = await res.json();
  return data;
}
// let existingBarChart = null;

function createHourlyBarChart(startTimeOfDay, domainName) {
  let hourlyUserSessionList;
  if (domainName)
    hourlyUserSessionList = fetchHourlyUserSessionsWithinDayForDomain(
      domainName,
      startTimeOfDay
    );
  else hourlyUserSessionList = fetchHourlyUserSessionsWithinDay(startTimeOfDay);

  const options = {
    plugins: {
      tooltip: {
        callbacks: {
          label: function (context) {
            return millisecondsToHoursMinutes(context.parsed.y);
          },
        },
      },
    },

    responsive: true,
    scales: {
      x: {
        title: {
          display: true,
          text: "Hours of the day", // Your x-axis label
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: millisecondsToHoursMinutes,
        },
      },
    },
  };

  hourlyUserSessionList.then((data) => {
    const totalTimeSpent = data.reduce((prev, curr) => prev + curr);
    console.log(totalTimeSpent);
    document.getElementById("time-spent").textContent =
      millisecondsToHoursMinutes(totalTimeSpent);
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: [
          "12:00 AM",
          "",
          "",
          "",
          "",
          "",
          "6:00 AM",
          "",
          "",
          "",
          "",
          "",
          "12:00 PM",
          "",
          "",
          "",
          "",
          "",
          "6:00 PM",
          "",
          "",
          "",
          "",
          "",
        ],
        datasets: [
          {
            label: domainName
              ? `hourly time consumption for ${domainName}`
              : `hourly time consumption`,
            data: data,
            backgroundColor: [
              "#000000", 
              "#02034E", 
              "#051B50", 
              "#07335B", 
              "#095560", 
              "#0B6B64", 
              "#0D8268", 
              "#0F986D", 
              "#11AE71", 
              "#13C575", 
              "#15DB7A", 
              "#17F27E", 
              "#1BF882", 
              "#3FFD8B", 
              "#5CFE9E", 
              "#79FFB2", 
              "#96FFC5", 
              "#B3FFD9", 
              "#D1FFEC", 
              "#EEFFFF", 
              "#FFFFFC", 
              "#FEF5FD", 
              "#FDD2FC", 
              "#FBADFB", 
            ],
          },
        ],
      },
      options: options,
    });
  });
}
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs.length > 0) {
    const activeTab = tabs[0];
    const hostName = new URL(activeTab.url).host;
    if (!activeTab.url.startsWith("https://")) {
      createHourlyBarChart(new Date().setHours(0, 0, 0, 0));
      return;
    }
    createHourlyBarChart(new Date().setHours(0, 0, 0, 0), hostName);
    const hostNameDivEle = document.getElementsByClassName("current-host")[0];

    const img = document.createElement("img");
    img.setAttribute("src", `https://${hostName}/favicon.ico`);
    img.setAttribute("alt", "favicon");
    img.addEventListener("error", function handleError() {
      img.src = "icons/a.png";
      img.alt = "default";
    });
    img.classList.add("favicon-image");

    const domainNameHeader = document.createElement("h3");
    domainNameHeader.textContent = hostName;

    hostNameDivEle.appendChild(img);
    hostNameDivEle.appendChild(domainNameHeader);
  }
});

function setNotification(notificationText) {
  document.querySelector("header h4").textContent = notificationText;
  clearNotification();
}

function clearNotification() {
  setTimeout(function () {
    document.querySelector("header h4").textContent = "";
  }, 4000);
}

document.addEventListener("DOMContentLoaded", function () {
  const recordButton = document.querySelector(".start-capture");
  const stopRecordButton = document.querySelector(".stop-capture");
  const setTimeLimitContainer = document.querySelector(".time-limit-setting");
  const recordTabContainer = document.querySelector(".record-tab-setting");

  const hourInputEle = document.getElementById("hour-input");
  const minuteInputEle = document.getElementById("minute-input");
  const timeLimitSetBtn = document.querySelector(".time-limit-setting button");

  timeLimitSetBtn.addEventListener("click", function () {
    const hourLimit = parseInt(hourInputEle.value);
    const minuteLimit = parseInt(minuteInputEle.value);
    if (
      hourLimit < 0 ||
      hourLimit > 23 ||
      minuteLimit < 1 ||
      minuteLimit > 59
    ) {
      setNotification("Enter valid input");

      return;
    }
    const timeInMS = timeToMilliseconds(hourLimit, minuteLimit);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const activeTab = tabs[0];
        const hostName = new URL(activeTab.url).host;
        chrome.runtime.sendMessage({ timeLimit: { hostName, timeInMS } });
        if (hourLimit) {
          setNotification(
            `Timer set for ${hourLimit} hour, ${minuteLimit} minute`
          );
        } else {
          setNotification(`Timer set for ${minuteLimit} minute`);
        }
      }
    });
  });

  chrome.alarms.get("recordTab", function (alarm) {
    if (alarm) {
      recordButton.classList.add("hidden");
      stopRecordButton.classList.remove("hidden");
    }
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const activeTab = tabs[0];
      if (!activeTab.url.startsWith("https://")) {
        setTimeLimitContainer.classList.add("hidden");
        recordTabContainer.classList.add("hidden");
      }
    }
  });

  recordButton.addEventListener("click", function () {
    chrome.runtime.sendMessage({ recordTab: true });
    recordButton.classList.add("hidden");
    stopRecordButton.classList.remove("hidden");
  });
  stopRecordButton.addEventListener("click", function () {
    chrome.runtime.sendMessage({ recordTab: false });
    recordButton.classList.remove("hidden");
    stopRecordButton.classList.add("hidden");
  });
});
