$(function () {
  $.fn.extend({
    animateCss: function (animationName) {
      var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
      this.addClass('animated ' + animationName).one(animationEnd, function () {
        $(this).removeClass('animated ' + animationName);
      });
    }
  });

  var activeTask;

  var $recyclebin = $(`<div class="ftk-recyclebin ftk-hidden"></div>`).appendTo('body');

  var $startOp = $(
    `<span class="list-card-operation dark-hover ftk-startoperation">Start</span>`
  ).appendTo($recyclebin);

  var $workingOn = $(`
    <span class="board-header-btn ftk-workingon" title="Click to open today's timesheet">
      <span class="ftk-workinglabel ftk-hidden">Working on <a class="ftk-taskname" href="#" title="Click to open card">Nothing</a>
      <span class="ftk-stopwatch"></span>
      <a class="ftk-stopbutton ftk-hidden" href="#">Stop</a></span>
      <span class="ftk-disconnected flash animated">Disconnected</span>
    </span>`).appendTo($recyclebin);

  var $buttonBar = $(`
    <div class="ftk-buttonbar fadeIn animated">
      <input class="ftk-startbutton" type="button" value="Start"/>
    </div>`).appendTo($recyclebin);

  //configure start and pause event handlers

  //$('.ftk-startbutton', $buttonBar).click(function (e) {
  $startOp.click(function (e) {
    e.stopPropagation();
    var $card = $(e.target).parents('.ftk-card');
    var childNodes = $($('.list-card-title', $card)[0].childNodes);
    var title = $(childNodes[childNodes.length - 1]).text();
    var url = $('.list-card-title', $card).attr('href');

    socketEmit('setActiveTask', { username: getUsername(), fullName: getFullName(), boardName: getBoardName(), cardId: url, title: title });
  });

  //configure all cards on page load
  $('.list-card').each(function (index, cardNode) {
    configureCard(cardNode);
  });

  //add working on label to board header
  configureWorkingOn();

  //observe loading of new boards and add working label to them
  $('#content', parent.document).observe('added', '#board', function (record) {
    configureWorkingOn();
  });

  //configure cards when they are added
  $('#content', parent.document).observe('added', '.list-card', function (record) {
    var cards = $('.list-card', record.addedNodes).each(function (index, card) {
      configureCard(card);
    });
  });

  //configure cards when they are updated
  $('#content', parent.document).observe('attributes', '.list-card', function (record) {
    configureCard(record.target);
  });

  function configureCard(cardNode) {
    var $card = $(cardNode);

    //do nothing if the node is not a card or is being composed or has already been configured or is a placeholder card
    if (!$card.hasClass('list-card') || $card.hasClass('js-composer') || $card.hasClass('ftk-card') || $card.hasClass('placeholder'))
      return;

    //configure the card

    //add a class to mark the card as processed
    $card.addClass('ftk-card');

    //show button bar only when mouse is over the card

    $card.hover(function (e) {
      //$buttonBar.appendTo($card);
      $startOp.appendTo($card);
    }, function (e) {
      //$buttonBar.appendTo($recyclebin);
      $startOp.appendTo($recyclebin);
    });
  }

  function configureWorkingOn() {
    var $leftButtons =
      $('.board-header-btns').filter((index, header) => $(header).hasClass('mod-left'));

    $workingOn.appendTo($leftButtons);
    $('.ftk-stopbutton', $workingOn).unbind('click');
    $('.ftk-stopbutton', $workingOn).click(function (e) {
      //send stop active task to server
      e.stopPropagation();
      socketEmit('stopActiveTask', { username: getUsername() });
    });

    $workingOn.click(function (e) {
      if (e.target === $('.ftk-taskname', $workingOn)[0])
        return;
      var newWin = window.open(`https://funtaskkit-smakazmi.rhcloud.com/?username=${getUsername()}&popup=1`, 'ftktimesheetwin', "width=500,height=400");
      if (window.focus) { newWin.focus() }

    });
  }

  function getFullName() {
    return $('.header-user .js-member-name', parent.document).text();
  }

  function getUsername() {
    var title = $('.header-user .member-initials', parent.document).attr('title');
    return title ? title.split(' (')[1].split(')')[0] : false;
  }

  function getBoardName() {
    return $('.board-header-btn-name').text();
  }

  //setup socket.io 

  function displayTask(task) {

    $('.ftk-workinglabel', $workingOn).removeClass('ftk-hidden');
    $('.ftk-disconnected', $workingOn).addClass('ftk-hidden');
    $('.ftk-taskname', $workingOn).text(task.title);
    $('.ftk-taskname', $workingOn).attr('href', task.cardId);
    $('.ftk-stopwatch', $workingOn).stopwatch('destroy');
    $('.ftk-stopwatch', $workingOn).stopwatch({ startTime: task.elapsed }).stopwatch('start');
    $('.ftk-stopbutton', $workingOn).removeClass('ftk-hidden');

    if (!activeTask || task.cardId != activeTask.cardId)
      $('.ftk-taskname', $workingOn).animateCss('flash');

    activeTask = task;
  }

  function stopTask() {
    
    $('.ftk-workinglabel', $workingOn).removeClass('ftk-hidden');
    $('.ftk-disconnected', $workingOn).addClass('ftk-hidden');
    $('.ftk-taskname', $workingOn).text('Nothing');
    $('.ftk-taskname', $workingOn).attr('href', '#');
    $('.ftk-stopwatch', $workingOn).stopwatch('destroy');
    $('.ftk-stopwatch', $workingOn).text('');
    $('.ftk-stopbutton', $workingOn).addClass('ftk-hidden');
  }

  

  // function showNotification({title, message, actions}) {
  //   chrome.runtime.sendMessage({ command: "showNotification", notificationId: "ftk-notification", title: title, message: message, actions: actions, }, function (response) {
  //     console.log(response);
  //   });
  // }

  var socketEvents = {};

  function socketOn(event, callback) {
    socketEvents[event] = callback;
  }

  function socketEmit(event, data) {
    chrome.runtime.sendMessage({ command: "socket", event: event, data: data});
  }

  socketOn('connect', function (data) {
    console.log('connected');
    stopTask();
    socketEmit('getActiveTask', { username: getUsername() });
  });

  socketOn('reconnect', function (data) {
    console.log('reconnected');
    socketEmit('getActiveTask', { username: getUsername() });
  });

  socketOn('disconnect', function (data) {
    console.log('disconnected');
    stopTask();
    
    $('.ftk-workinglabel', $workingOn).addClass('ftk-hidden');
    $('.ftk-disconnected', $workingOn).removeClass('ftk-hidden');
    //showNotification({ title: "Disconnected", message: "Having connectivity issues..." });
  });

  socketOn('OnActiveTaskSet', function (task) {
    console.log('onActiveTaskSet', task);
    displayTask(task);
    //showNotification({ title: "Working", message: `Working on ${task.title}`, actions: ["Stop"] });
  });

  socketOn('OnActiveTaskStopped', function (cardId) {
    console.log('onActiveTaskStopped');
    stopTask();
    //showNotification({ title: "Not Working", message: `Working on nothing!` });
  });

  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      
      console.log("msg recv by content script: ", request);
        
      if (request.command === "socket") {
        if (socketEvents[request.data.event])
          socketEvents[request.data.event](request.data.data);
      }
  });

  function pollConnectionState() {
    var username = getUsername();
    if (username) {
      chrome.runtime.sendMessage({ command: "pollConnectionState"});
    }
    else {
      setTimeout(pollConnectionState, 500);
    }  
  }

  pollConnectionState();
  
    
});