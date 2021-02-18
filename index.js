'use strict';

const fs = require('fs');
const util = require('util');
const firebase = require('firebase/app');
require('firebase/database');
const open = require('opn');
const termkit = require('terminal-kit');
const term = termkit.createTerminal();
const document = term.createDocument();
let columnMenu = null;
let itemsCache = {};
let topStoryIds = [];
let storiesPerPage = 10;
let currentPage = 1;
let lastPage = 1;
const logFilePrefix = 'hn-cli-';
const logBasePath = '/tmp/';

term.grabInput({ mouse: false });
term.clear();
term.on('resize', (w, h) => {
  updateTitle();
  updateStatus();
  updateStoryMeta();
});

const updateTitle = () => {
  const x = 2;
  const y = 2;
  const msg = ' Hacker News Top Stories, page ' + currentPage;
  term.saveCursor();
  term.moveTo(x, y).bgBlack().white().eraseLine();
  term.moveTo(x, y, '%s\n', msg);
  term.restoreCursor();
};

const updateStoryMeta = () => {
  const x = 2;
  const y = 18;
  let msg = '';
  if (columnMenu && columnMenu.focusChild) {
    const v = columnMenu.focusChild.value;
    msg = util.format(
      'by %s, at %s, score: %s, comments: %s',
      v.by,
      formatDate(new Date(v.time * 1000)),
      v.score ? v.score : 0,
      v.descendants ? v.descendants : 0
    );
  }
  msg = ' ' + msg;
  term.saveCursor();
  term.moveTo(x, y).bgBlack().white().eraseLine();
  term.moveTo(x, y, '%s\n', msg);
  term.restoreCursor();
};

const updateStatus = msg => {
  const x = 2;
  const y = 20;
  if (!msg) {
    msg = [
      'j: down',
      ' | ',
      'k: up',
      ' | ',
      'h: prev page',
      ' | ',
      'l: next page',
      ' | ',
      'c: open comment',
    ].join('');
  }
  msg = ' ' + msg;
  term.saveCursor();
  term.moveTo(x, y).bgBlack().white().eraseLine();
  term.moveTo(x, y, '%s\n', msg);
  term
    .moveTo(x, y + 1)
    .bgBlack()
    .white()
    .eraseLine();
  term.moveTo(x, y + 1, '%s\n', ' q: quit');
  term.restoreCursor();
};

term.on('key', key => {
  switch (key) {
    case 'q':
    case 'CTRL_C':
      term.grabInput(false);
      term.hideCursor(false);
      term.styleReset();
      term.clear();
      process.exit();
      break;
    case 'h':
    case 'LEFT':
      if (currentPage > 1) {
        createMenu(currentPage - 1);
      }
      break;
    case 'l':
    case 'RIGHT':
      if (currentPage < lastPage) {
        createMenu(currentPage + 1);
      }
      break;
    case 'c':
      if (columnMenu && columnMenu.focusChild) {
        const v = columnMenu.focusChild.value;
        if (v.id) {
          const commentLink = util.format(
            'https://news.ycombinator.com/item?id=%s',
            v.id
          );
          open(commentLink).catch(err => {
            log(err);
          });
        }
      }
      break;
    default:
      updateStoryMeta();
  }
});

firebase.initializeApp({
  databaseURL: 'https://hacker-news.firebaseio.com',
});
const db = firebase.database();
updateStatus('downloading...');

db.ref('v0/topstories').once(
  'value',
  snapshot => {
    topStoryIds = snapshot.val();
    lastPage = Math.ceil(topStoryIds.length / storiesPerPage);
    log('top story IDs fetched');
    createMenu(1);
  },
  err => {
    log(err);
  }
);

const createMenu = page => {
  fetchItemsByPage(page).then(
    values => {
      currentPage = page;
      let items = [];
      const maxIndex = (currentPage - 1) * storiesPerPage + values.length;
      const maxIndexDigit = new String(maxIndex).length;
      values.forEach((v, i) => {
        let index = (currentPage - 1) * storiesPerPage + (i + 1);
        const indexDigit = new String(index).length;
        const diff = maxIndexDigit - indexDigit;
        for (let j = 0; j < diff; j++) {
          index = ' ' + index;
        }
        const val = v
          ? v
          : {
              id: null,
              title: '---',
              by: '-',
              time: null,
              score: '-',
              descendants: '-',
            };
        items.push({
          content: index + ') ' + val.title.replace(/(^\s+)|(\s+$)/, ''),
          value: val,
        });
      });
      if (
        columnMenu &&
        columnMenu.destroy &&
        'function' === typeof columnMenu.destroy
      ) {
        columnMenu.destroy();
      }
      columnMenu = new termkit.ColumnMenu({
        x: 1,
        y: 3,
        keyBindings: {
          j: 'next',
          k: 'previous',
          UP: 'previous',
          DOWN: 'next',
          ENTER: 'submit',
        },
        parent: document,
        items: items,
        buttonFocusAttr: { bgColor: 'white', color: 'black', bold: false },
        buttonBlurAttr: { bgColor: 'black', color: 'white', bold: false },
      });
      columnMenu.on('submit', value => {
        if (value.url) {
          open(value.url).catch(err => {
            log(err);
          });
        } else if (value.id) {
          const commentLink = util.format(
            'https://news.ycombinator.com/item?id=%s',
            value.id
          );
          open(commentLink).catch(err => {
            log(err);
          });
        }
      });
      document.giveFocusTo(columnMenu);
      updateTitle();
      updateStatus();
      updateStoryMeta();
    },
    reason => {
      log(reason);
    }
  );
};

const fetchItem = id => {
  return new Promise((resolve, reject) => {
    if (itemsCache[id]) {
      log('hitting item ' + id + ' in cache');
      resolve(itemsCache[id]);
    } else {
      log('fetching item ' + id);
      db.ref('v0/item/' + id).once(
        'value',
        snapshot => {
          itemsCache[id] = snapshot.val();
          resolve(itemsCache[id]);
        },
        err => {
          reject(err);
        }
      );
    }
  });
};

const fetchItems = ids => {
  if (!ids || !ids.length) {
    return Promise.resolve([]);
  } else {
    return Promise.all(
      ids.map(id => {
        return fetchItem(id);
      })
    );
  }
};

const fetchItemsByPage = page => {
  const start = (page - 1) * storiesPerPage;
  const end = page * storiesPerPage;
  const ids = topStoryIds.slice(start, end);
  return fetchItems(ids);
};

const log = msg => {
  const now = new Date();
  const dateStr = formatDate(now);
  const ymd = dateStr.split(' ')[0];
  const path = logBasePath + logFilePrefix + ymd;
  const data = dateStr + ' ' + msg + '\n';
  fs.appendFile(path, data, err => {});
};

const formatDate = dateObj => {
  if (dateObj instanceof Date && 'function' !== typeof dateObj.getFullYear) {
    return 'xxxx-xx-xx xx:xx';
  }
  const year = new String(dateObj.getFullYear());
  const month = new String(dateObj.getMonth() + 1);
  const date = new String(dateObj.getDate());
  const hour = new String(dateObj.getHours());
  const minute = new String(dateObj.getMinutes());
  return [
    year,
    '-',
    1 === month.length ? '0' + month : month,
    '-',
    1 === date.length ? '0' + date : date,
    ' ',
    1 === hour.length ? '0' + hour : hour,
    ':',
    1 === minute.length ? '0' + minute : minute,
  ].join('');
};
