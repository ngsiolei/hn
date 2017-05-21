const fs = require('fs');
const util = require('util');
const firebase = require('firebase');
const open = require('open');
const termkit = require('terminal-kit');
const term = termkit.terminal;
const document = term.createDocument();
let columnMenu = null;
let itemsCache = {};
let topStoryIds = [];
let storiesPerPage = 10;
let currentPage = 1;

term.grabInput({mouse: false});
term.clear();

const updateStoryMeta = () => {
  let msg = '';
  if (columnMenu && columnMenu.focusChild) {
    const v = columnMenu.focusChild.value;
    msg = util.format(
      'by %s, at %s, score: %s, comments: %s (c: open comment page)',
      v.by,
      formatDate(v.time),
      v.score ? v.score : 0,
      v.descendants ? v.descendants : 0
    );
  }
  msg = ' ' + msg;
  term.saveCursor();
  term.moveTo.eraseLine(1, 20, '%s\n', msg);
  term.restoreCursor();
};

const updateStatus = (msg) => {
  if (!msg) {
    msg = 'j: down | k: up | h: prev page | l: next page | ctrl-c: exit';
  }
  msg = ' ' + msg;
  term.saveCursor();
  term.moveTo.eraseLine(1, 22, '%s\n', msg);
  term.restoreCursor();
};

term.on('key', (key) => {
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
    case 'c':
      if (columnMenu && columnMenu.focusChild) {
        const v = columnMenu.focusChild.value;
        const commentLink = util.format(
          'https://news.ycombinator.com/item?id=%s',
          v.id
        );
        open(commentLink);
      }
      break;
    default:
      updateStoryMeta();
  }
});

firebase.initializeApp({
  databaseURL: 'https://hacker-news.firebaseio.com'
});
const db = firebase.database();
updateStatus('downloading...');

db.ref('v0/topstories').once('value', (snapshot) => {
  topStoryIds = snapshot.val();
  log('topStoryIds fetched');
  createMenu(1);
}, (err) => {
  log(err);
});

const createMenu = (page) => {
  fetchItemsByPage(page).then((values) => {
    currentPage = page;
    let items = [];
    const maxIndex = (currentPage - 1) * storiesPerPage + values.length;
    const maxIndexDigit = new String(maxIndex).length;
    values.forEach((v, i) => {
      let index = (currentPage - 1) * storiesPerPage + (i + 1);
      indexDigit = new String(index).length;
      const diff = maxIndexDigit - indexDigit;
      for (let j = 0; j < diff; j++) {
        index = ' ' + index;
      }
      items.push({
        content: index + ') ' + v.title,
        value: v
      });
    });
    if (columnMenu &&
        columnMenu.destroy &&
        'function' === typeof columnMenu.destroy) {
      columnMenu.destroy();
    }
    columnMenu = termkit.ColumnMenu.create({
      buttonFocusAttr: {bgColor: 'white', color: 'black', bold: false},
      buttonBlurAttr: {bgColor: 'black', color: 'white', bold: false},
      keyBindings: {j: 'next', k: 'previous', UP: 'previous', DOWN: 'next'},
      parent: document,
      items: items,
    });
    columnMenu.on('submit', (value) => {
      if (value.url) {
        open(value.url);
      } else if (value.id) {
        const commentLink = util.format(
          'https://news.ycombinator.com/item?id=%s',
          value.id
        );
        open(commentLink);
      }
    });
    document.giveFocusTo(columnMenu);
    updateStatus();
    updateStoryMeta();
  }, (reason) => {
    log(reason);
  });
};

const fetchItem = (id) => {
  return new Promise((resolve, reject) => {
    if (itemsCache[id]) {
      log('hitting item ' + id + ' in cache');
      resolve(itemsCache[id]);
    } else {
      log('fetching item ' + id);
      db.ref('v0/item/' + id).once('value', (snapshot) => {
        itemsCache[id] = snapshot.val();
        resolve(itemsCache[id]);
      }, (err) => {
        reject(err);
      });
    }
  });
};

const fetchItems = (ids) => {
  if (!ids || !ids.length) {
    return Promise.resolve([]);
  } else {
    return Promise.all(ids.map((id) => {
      return fetchItem(id);
    }));
  }
};

const fetchItemsByPage = (page) => {
  const start = (page - 1) * storiesPerPage;
  const end = page * storiesPerPage;
  const ids = topStoryIds.slice(start, end);
  return fetchItems(ids);
};

const log = (msg) => {
  const now = new Date();
  const year = new String(now.getFullYear());
  let month = new String(now.getMonth() + 1);
  if (month.length === 1) {
    month = '0' + month;
  }
  let date = new String(now.getDate());
  if (date.length === 1) {
    date = '0' + date;
  }
  const filename = 'hn-cli-' + year + month + date;
  fs.appendFile('/tmp/' + filename,
                msg + '\n',
                () => {});
};

const formatDate = (ts) => {
  ts = ts * 1000;
  const dateObj = new Date(ts);
  const year = new String(dateObj.getFullYear());
  let month = new String(dateObj.getMonth() + 1);
  if (month.length === 1) {
    month = '0' + month;
  }
  let date = new String(dateObj.getDate());
  if (date.length === 1) {
    date = '0' + date;
  }
  let hour = new String(dateObj.getHours());
  if (hour.length === 1) {
    hour = '0' + hour;
  }
  let minute = new String(dateObj.getMinutes());
  if (minute.length === 1) {
    minute = '0' + minute;
  }
  return year + '-' + month + '-' + date + ' ' + hour + ':' + minute;
};
