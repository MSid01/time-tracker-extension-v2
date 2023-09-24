import {
  API_URL,
  millisecondsToHoursMinutes,
  timeToMilliseconds,
} from "./utilities.js";

// const API_URL = "http://192.168.48.1:8080/api";
let userId;
const hoursArray = [];

let lastNTime = 30 * 60 * 1000;
let currentDate = Date.now() - lastNTime;
let currentDomain = null;

for (let i = 1; i <= 24; i++) {
  hoursArray.push(i);
}

const options = {
  method: "GET",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Credentials": true,
  },
};

const downloadCsvBtn = document.getElementById("download-csv-btn");

downloadCsvBtn.addEventListener("click", function () {
  fetch(`${API_URL}/csv/download`, options)
    .then((response) => {
      if (response.status === 200) {
        return response.blob();
      } else {
        throw new Error("Failed to download CSV");
      }
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = "activity.csv";

      // Trigger the download
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    })
    .catch((error) => {
      console.error(error);
    });
});

const datePickerEle = document.querySelector(".date-filter input");
const domainNameInputEle = document.getElementById("domain_name");
// const domainNameBtnEle = document.getElementById("set-domain-btn");

const lastNHourEle = document.getElementById("last-n-hour-filter");
const lastNMinuteELE = document.getElementById("last-n-minute-filter");
const lastNTimeBtnEle = document.getElementById("set-last-n-time-btn");

const toggleButton = document.getElementById("toggleButton");
const viewAllButton = document.getElementsByClassName("view-all-btn")[0];
viewAllButton.classList.add("hidden");

const hourlyChartContainer = document.getElementsByClassName(
  "hourly-chart-container"
)[0];
const pieChartContainer = document.getElementsByClassName(
  "pie-chart-container"
)[0];

var [hour, minute, seconds] = millisecondsToHMS(lastNTime);
lastNHourEle.value = hour;
lastNMinuteELE.value = minute;

const hourlyChart = document.getElementById("hourly-chart");
let existingBarChart = null;

const pieChart = document.getElementById("pie-chart");
let existingPieChart = null;

function millisecondsToHMS(milliseconds) {
  const hours = Math.floor(milliseconds / (60 * 60 * 1000));
  const remainingMilliseconds = milliseconds % (60 * 60 * 1000);
  const minutes = Math.floor(remainingMilliseconds / (60 * 1000));
  const seconds = Math.floor((remainingMilliseconds % (60 * 1000)) / 1000);

  return [hours, minutes, seconds];
}

function generateRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function generateRandomColors(n) {
  const colors = [];
  for (let i = 0; i < n; i++) {
    colors.push(generateRandomColor());
  }
  return colors;
}

async function fetchUserSessionsByDomains(startTime, endTime) {
  const userSessionsList = await fetch(
    `${API_URL}/user_sessions?start_time=${startTime}&end_time=${endTime}`,
    options
  ).then((res) => {
    if (!res.ok) throw new Error("failed to fetch the resources");
    return res.json();
  });
  return userSessionsList;
}

viewAllButton.addEventListener("click", () => {
  currentDomain = null;
  domainNameInputEle.value = "";
  buildCharts();
  viewAllButton.classList.add("hidden");
});

async function fetchUserSessionsForDomain(domainName, startTime, endTime) {
  const userSessionsList = await fetch(
    `${API_URL}/user_sessions/${domainName}?start_time=${startTime}&end_time=${endTime}`,
    options
  ).then((res) => {
    if (!res.ok) throw new Error("failed to fetch the resources");
    return res.json();
  });
  return userSessionsList;
}

async function fetchDomainSelectionList() {
  const domainSelectionList = await fetch(`${API_URL}/domain_list`).then(
    (res) => {
      if (!res.ok) throw new Error("failed to fetch the resources");
      return res.json();
    }
  );
  return domainSelectionList;
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

const domainConsumptionEle = document.querySelector(".domain-consumption ul");

function createHourlyBarChart(startTimeOfDay, domainName) {
  let hourlyUserSessionList;
  if (domainName)
    hourlyUserSessionList = fetchHourlyUserSessionsWithinDayForDomain(
      domainName,
      startTimeOfDay
    );
  else hourlyUserSessionList = fetchHourlyUserSessionsWithinDay(startTimeOfDay);
  if (existingBarChart) {
    existingBarChart.destroy();
  }

  hourlyUserSessionList.then((data) => {
    existingBarChart = new Chart(hourlyChart, {
      type: "bar",
      data: {
        labels: hoursArray,
        datasets: [
          {
            label: domainName
              ? `hourly time consumption for ${domainName}`
              : `hourly time consumption`,
            data: data,
            borderWidth: 1,
            backgroundColor: generateRandomColor(),
          },
        ],
      },
      options: {
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
      },
    });
  });
}

function createDomainConsumptionList(startTime, endTime, domainName) {
  let userSessionsList;
  console.log(domainName);
  if (domainName)
    userSessionsList = fetchUserSessionsForDomain(
      domainName,
      startTime,
      endTime
    );
  else userSessionsList = fetchUserSessionsByDomains(startTime, endTime);

  while (domainConsumptionEle.firstChild) {
    domainConsumptionEle.removeChild(domainConsumptionEle.firstChild);
  }

  userSessionsList.then((response) => {
    if (response.length == 0) {
      const li = document.createElement("li");
      const noActivityText = document.createElement("h3");
      noActivityText.textContent = "No activity!!";
      li.appendChild(noActivityText);
      domainConsumptionEle.appendChild(li);
      return;
    }
    response.forEach((item) => {
      const li = document.createElement("li");
      li.addEventListener("click", () => {
        if (domainNameInputEle.value === item.domainName) return;
        currentDomain = item.domainName;
        domainNameInputEle.value = item.domainName;
        viewAllButton.classList.remove("hidden");
        createHourlyBarChart(currentDate, currentDomain);
        createDomainConsumptionList(
          currentDate,
          currentDate + 24 * 3600 * 1000 - 1,
          currentDomain
        );
      });

      const img = document.createElement("img");
      img.setAttribute("src", `https://${item.domainName}/favicon.ico`);
      img.addEventListener("error", function handleError() {
        img.src = "icons/a.png";
        img.alt = "default";
      });
      img.classList.add("favicon-image");

      const domainNameHeader = document.createElement("h3");
      domainNameHeader.textContent = item.domainName;

      const totalTimeSpentHeader = document.createElement("h4");
      totalTimeSpentHeader.textContent = millisecondsToHoursMinutes(
        item.totalTimeSpent
      );

      // Append the image and headers to the list item
      li.appendChild(img);
      li.appendChild(domainNameHeader);
      li.appendChild(totalTimeSpentHeader);

      // Append the list item to the unordered list
      domainConsumptionEle.appendChild(li);
    });
  });
}

function createPieChart(startTime, endTime) {
  const userSessionsList = fetchUserSessionsByDomains(startTime, endTime);

  const labels = [];
  const values = [];
  userSessionsList.then((response) => {
    console.log(response);
    response.forEach((item) => {
      labels.push(item.domainName);
      values.push(item.totalTimeSpent);
    });

    const colorsArray = generateRandomColors(labels.length);

    const data = {
      labels: labels,
      datasets: [
        {
          data: values,
          backgroundColor: colorsArray,
        },
      ],
    };

    if (existingPieChart) {
      existingPieChart.destroy();
    }

    existingPieChart = new Chart(pieChart, {
      type: "doughnut",
      data: data,
      options: {
        plugins: {
          legend: {
            position: "right",
          },
        },
      },
    });
  });
}

function createSelectionList() {
  const domainSelectionList = fetchDomainSelectionList();
  domainSelectionList.then((data) => {
    data.forEach((item) => {
      var option = document.createElement("option");
      option.value = item;
      option.text = item;
      domainNameInputEle.appendChild(option);
    });
  });
}

function getCurrentDateString() {
  const currentDate = new Date();

  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0"); // Month is zero-based, so we add 1
  const day = String(currentDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

datePickerEle.value = getCurrentDateString();

datePickerEle.addEventListener("change", (e) => {
  const selectedDate = new Date(e.target.value);
  selectedDate.setHours(0, 0, 0, 0);
  lastNHourEle.value = "";
  lastNMinuteELE.value = "";
  lastNTime = null;
  currentDate = selectedDate.getTime();

  domainNameInputEle.value = "";
  currentDomain = null;
  buildCharts();
});

domainNameInputEle.addEventListener("change", (e) => {
  currentDomain = domainNameInputEle.value;
  viewAllButton.classList.remove("hidden");
  buildCharts();
});

lastNTimeBtnEle.addEventListener("click", () => {
  datePickerEle.value = getCurrentDateString();
  const newLastNTime = timeToMilliseconds(
    parseInt(lastNHourEle.value) || 0,
    parseInt(lastNMinuteELE.value)
  );
  if (newLastNTime === lastNTime) return;
  lastNTime = newLastNTime;
  currentDate = Date.now() - lastNTime;
  console.log(currentDate, lastNTime, currentDomain);
  buildCharts();
});

createSelectionList();

function buildCharts() {
  createHourlyBarChart(currentDate, currentDomain);
  createDomainConsumptionList(
    currentDate,
    currentDate + 24 * 3600 * 1000 - 1,
    currentDomain
  );
  createPieChart(currentDate, currentDate + 24 * 3600 * 1000 - 1);
}
buildCharts();

toggleButton.addEventListener("click", () => {
  if (hourlyChartContainer.classList.contains("hidden")) {
    hourlyChartContainer.classList.remove("hidden");
    pieChartContainer.classList.add("hidden");
    toggleButton.textContent = "View Piechart";
  } else {
    hourlyChartContainer.classList.add("hidden");
    pieChartContainer.classList.remove("hidden");
    toggleButton.textContent = "View hourly consumption";
  }
});

/* 
const captureButton = document.getElementById("capture-button");
  
    captureButton.addEventListener("click", function() {
      chrome.tabs.captureVisibleTab(function(screenshotDataUrl) {
        
        const filename = 'screenshot_' + Date.now() + '.png';
        chrome.downloads.download({
          url: screenshotDataUrl,
          filename: filename,
          saveAs: false, // Set to true if you want to prompt the user for the download location
        }, function (downloadId) {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
          } else {
            console.log('Screenshot downloaded as ' + filename);
          }
        });
      });
    }); */
