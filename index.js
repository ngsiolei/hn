var firebase = require('firebase');
var open = require('open');
var termkit = require('terminal-kit');
var term = termkit.terminal;
term.clear();
var document = term.createDocument();

function onSubmit(value) {
	term.saveCursor();
	term.moveTo.styleReset.eraseLine(1, 22, '%s\n', value);
	term.restoreCursor();
  open(value);
}

term.on('key', function (key) {
	switch (key) {
		case 'CTRL_C' :
			term.grabInput( false );
			term.hideCursor( false );
			term.styleReset();
			term.clear();
			process.exit();
			break;
	}
});

firebase.initializeApp({
  databaseURL: 'https://hacker-news.firebaseio.com'
});

var db = firebase.database();

var itemsCache = {};
var topStoryIds = [];
var storiesPerPage = 10;

db.ref('v0/topstories').once('value', function (snapshot) {
  topStoryIds = snapshot.val();
  //console.log('[INFO] topStoryIds fetched');
  fetchItemsByPage(1).then(function (values) {
    var items = [];
    values.forEach(function (v) {
      //console.log(v.title);
      items.push({
        content: '* ' + v.title,
        value: v.url
      });
    });
    var columnMenu = termkit.ColumnMenu.create({
      buttonFocusAttr: {bgColor: 'white', color: 'black', bold: false},
      buttonBlurAttr: {bgColor: 'black', color: 'gray', bold: false},
      keyBindings: {j: 'next', k: 'previous', UP: 'previous', DOWN: 'next'},
      parent: document,
      items: items,
    });
    columnMenu.on('submit', onSubmit);
    document.giveFocusTo(columnMenu);
  }, function (reason) {
    console.log(reason);
  });
}, function (err) {
  console.log(err);
});

/*
  fetchItem(topStoryIds[0]).then(function (value) {
    console.log(value);
  }, function (reason) {
    console.log(reason);
  });
*/

var fetchItem = function (id) {
  return new Promise(function (resolve, reject) {
    if (itemsCache[id]) {
      //console.log('[INFO] hitting item ' + id + ' in cache');
      resolve(itemsCache[id]);
    } else {
      //console.log('[INFO] fetching item ' + id);
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
