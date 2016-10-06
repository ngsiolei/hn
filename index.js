var fs = require('fs');
var util = require('util');
var firebase = require('firebase');
var open = require('open');
var termkit = require('terminal-kit');
var term = termkit.terminal;
var document = term.createDocument();
var columnMenu = null;
var itemsCache = {};
var topStoryIds = [];
var storiesPerPage = 10;
var currentPage = 1;

term.grabInput({mouse: false});
term.clear();

var updateStoryMeta = function () {
  if (columnMenu && columnMenu.focusChild) {
    var v = columnMenu.focusChild.value;
    var msg = util.format(
      'by %s, at %s, score: %s, comments: %s',
      v[1],
      formatDate(v[2]),
      v[3],
      v[4]
    );
  } else {
    msg = '';
  }
  msg = ' ' + msg;
  term.saveCursor();
  term.moveTo.eraseLine(1, 20, '%s\n', msg);
  term.restoreCursor();
};

var updateStatus = function (msg) {
  if (!msg) {
    msg = 'j: down | k: up | h: prev page | l: next page | ctrl-c: exit';
  }
  msg = ' ' + msg;
  term.saveCursor();
  term.moveTo.eraseLine(1, 22, '%s\n', msg);
  term.restoreCursor();
};

term.on('key', function (key) {
  switch (key) {
    case 'CTRL_C':
      term.grabInput( false );
      term.hideCursor( false );
      term.styleReset();
      term.clear();
      process.exit();
      break;
    case 'h':
      if (currentPage > 1) {
        createMenu(currentPage - 1);
      }
      break;
    case 'l':
      createMenu(currentPage + 1);
      break;
    default:
      updateStoryMeta();
  }
});

firebase.initializeApp({
  databaseURL: 'https://hacker-news.firebaseio.com'
});
var db = firebase.database();
updateStatus('downloading...');

db.ref('v0/topstories').once('value', function (snapshot) {
  topStoryIds = snapshot.val();
  log('topStoryIds fetched');
  createMenu(1);
}, function (err) {
  log(err);
});

var createMenu = function (page) {
  fetchItemsByPage(page).then(function (values) {
    currentPage = page;
    var items = [];
    var maxIndex = (currentPage - 1) * storiesPerPage + values.length;
    var maxIndexDigit = new String(maxIndex).length;
    values.forEach(function (v, i) {
      var index = (currentPage - 1) * storiesPerPage + (i + 1);
      indexDigit = new String(index).length;
      var diff = maxIndexDigit - indexDigit;
      for (var j = 0; j < diff; j++) {
        index = ' ' + index;
      }
      items.push({
        content: index + ') ' + v.title,
        value: [
          v.url,
          v.by,
          v.time,
          v.score ? v.score : 0,
          v.descendants ? v.descendants : 0
        ]
      });
    });
    if (columnMenu && columnMenu.destroy && typeof columnMenu.destroy === 'function') {
      columnMenu.destroy();
    }
    columnMenu = termkit.ColumnMenu.create({
      buttonFocusAttr: {bgColor: 'white', color: 'black', bold: false},
      buttonBlurAttr: {bgColor: 'black', color: 'white', bold: false},
      keyBindings: {j: 'next', k: 'previous', UP: 'previous', DOWN: 'next'},
      parent: document,
      items: items,
    });
    columnMenu.on('submit', function (value) {
      open(value[0]);
    });
    document.giveFocusTo(columnMenu);
    updateStatus();
    updateStoryMeta();
  }, function (reason) {
    log(reason);
  });
};

var fetchItem = function (id) {
  return new Promise(function (resolve, reject) {
    if (itemsCache[id]) {
      log('hitting item ' + id + ' in cache');
      resolve(itemsCache[id]);
    } else {
      log('fetching item ' + id);
      db.ref('v0/item/' + id).once('value', function (snapshot) {
        itemsCache[id] = snapshot.val();
        resolve(itemsCache[id]);
      }, function (err) {
        reject(err);
      });
    }
  });
};

var fetchItems = function (ids) {
  if (!ids || !ids.length) {
    return Promise.resolve([]);
  } else {
    return Promise.all(ids.map(function (id) {
      return fetchItem(id);
    }));
  }
};

var fetchItemsByPage = function (page) {
  var start = (page - 1) * storiesPerPage;
  var end = page * storiesPerPage;
  var ids = topStoryIds.slice(start, end);
  return fetchItems(ids);
};

var log = function (msg) {
  var now = new Date();
  var year = new String(now.getFullYear());
  var month = new String(now.getMonth() + 1);
  if (month.length === 1) {
    month = '0' + month;
  }
  var date = new String(now.getDate());
  if (date.length === 1) {
    date = '0' + date;
  }
  var filename = 'hn-cli-' + year + month + date;
  fs.appendFile('/tmp/' + filename,
                msg + '\n',
                function () {});
};

var formatDate = function (ts) {
  ts = ts * 1000;
  var dateObj = new Date(ts);
  var year = new String(dateObj.getFullYear());
  var month = new String(dateObj.getMonth() + 1);
  if (month.length === 1) {
    month = '0' + month;
  }
  var date = new String(dateObj.getDate());
  if (date.length === 1) {
    date = '0' + date;
  }
  var hour = new String(dateObj.getHours());
  if (hour.length === 1) {
    hour = '0' + hour;
  }
  var minute = new String(dateObj.getMinutes());
  if (minute.length === 1) {
    minute = '0' + minute;
  }
  return year + '-' + month + '-' + date + ' ' + hour + ':' + minute;
};
