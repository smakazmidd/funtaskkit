var state = "disconnect";

var syncTimerId = 0;
var activeTask;
var isIdle = false;

function saveUsername(username) {
  chrome.storage.local.set({ 'username': username });
}

function getUsername(callback) {
  return chrome.storage.local.get('username', (vals) => {
    callback(vals['username']);
  });
}

function sendToAllTabs(command, data) {
  chrome.tabs.query({ url: "https://*.trello.com/*" }, function (tabs) {
    tabs.forEach((t) => {
      chrome.tabs.sendMessage(t.id, { command: command, data: data });
    });
  });
}

function sendToTab(tabId, command, data) {
  chrome.tabs.sendMessage(tabId, { command: command, data: data });
}

function syncActiveTask(force) {
  if (!force && (!activeTask || isIdle))
    return;
  console.log('syncing task', activeTask);
  socket.emit('setActiveTask', activeTask);
}

sendToAllTabs("socket", { event: state });



var socket = io.connect('https://funtaskkit-smakazmi.rhcloud.com/');

socket.on('connect', function (data) {
  state = "connect";
  getUsername((username) => {
    if (username)
      socket.emit('getActiveTask', { username: username });
  });

  sendToAllTabs("socket", { event: "connect", data: data });
});

socket.on('reconnect', function (data) {
  state = "reconnect";
  getUsername((username) => {
    if (username)
      socket.emit('getActiveTask', { username: username });
  });
  sendToAllTabs("socket", { event: "reconnect", data: data });
});

socket.on('disconnect', function (data) {
  state = "disconnect";
  clearInterval(syncTimerId);
  sendToAllTabs("socket", { event: "disconnect", data: data });
  showNotification({ title: "Disconnected", message: "Having connectivity issues..." });
});

socket.on('OnActiveTaskSet', function (task) {
  activeTask = task;
  saveUsername(task.username);
  clearInterval(syncTimerId);
  syncTimerId = setInterval(syncActiveTask, 30000);
  sendToAllTabs("socket", { event: "OnActiveTaskSet", data: task });
  var totalTime = moment.duration(task.elapsed).humanize();
  var hasOrHave = "has";
  if (totalTime[totalTime.length - 1] === 's') {
    hasOrHave = "have";
  }
  showNotification({ title: "Working", message: `Working on ${task.title}. A total of ${totalTime} ${hasOrHave} been spent on this task so far by you.`, actions: ["Stop"] });
});

socket.on('OnActiveTaskStopped', function (cardId) {
  activeTask = null;
  sendToAllTabs("socket", { event: "OnActiveTaskStopped", data: cardId });
  showNotification({ title: "Not Working", message: `Working on nothing!` });
});

socket.on('welcome', function (data) {
  console.log(data);
});

socket.on('log', function (data) {
  console.log("SERVER LOG", data);
});

function showNotification(request) {
  var nOptions = {
    title: request.title,
    message: request.message,
    buttons: request.actions ? request.actions.map((a) => { return { title: a } }) : null,
    requireInteraction: true,
    iconUrl: 'icon2.png',
    type: 'basic'
  };

  chrome.notifications.create("ftk-notification", nOptions);
}

chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {

    console.log("msg recv by bg page: ", request);

    if (request.command === "socket") {
      socket.emit(request.event, request.data);
    }
    else if (request.command == "pollConnectionState") {
      sendToTab(sender.tab.id, "socket", { event: state, data: {} });
    }
  });

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId == "ftk-notification") {
    chrome.tabs.query({ url: "https://*.trello.com/*" }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { selected: true });
      }
      else {
        chrome.tabs.create({ url: "https://trello.com", active: true }, (tab) => {

        });
      }
    });
  }
});

chrome.notifications.onButtonClicked.addListener((id, index) => {
  if (id == "ftk-notification") {
    if (index == 0) { //stop task
      getUsername((username) => {
        if (username)
          socket.emit('stopActiveTask', { username: username });
      });
    }
  }
})


