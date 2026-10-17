const assert = require('node:assert/strict');

function clearModules() {
  [
    '../pages/profile-edit/index',
    '../services/profile',
    '../utils/auth',
    '../utils/notify'
  ].forEach((modulePath) => {
    delete require.cache[require.resolve(modulePath)];
  });
}

function applySetData(target, patch) {
  Object.keys(patch).forEach((key) => {
    if (key.indexOf('.') < 0) {
      target.data[key] = patch[key];
      return;
    }
    const parts = key.split('.');
    let cursor = target.data;
    parts.slice(0, -1).forEach((part) => {
      cursor[part] = cursor[part] || {};
      cursor = cursor[part];
    });
    cursor[parts[parts.length - 1]] = patch[key];
  });
}

function loadProfileEditPage(options) {
  let page = null;
  const service = options.service;
  const auth = options.auth;
  const notify = options.notify;
  const navigationEvents = options.navigationEvents || [];

  global.Page = (definition) => {
    page = {
      data: { ...(definition.data || {}) },
      setData(patch) {
        applySetData(this, patch);
      },
      selectComponent() {
        return null;
      },
      ...definition
    };
  };
  global.wx = {
    navigateBack() {
      navigationEvents.push({ type: 'navigateBack' });
    },
    switchTab(options) {
      navigationEvents.push({ type: 'switchTab', url: options && options.url });
    },
    showToast() {}
  };
  global.getApp = () => ({ globalData: {} });
  global.getCurrentPages = () => [page];

  clearModules();
  require.cache[require.resolve('../services/profile')] = {
    id: require.resolve('../services/profile'),
    filename: require.resolve('../services/profile'),
    loaded: true,
    exports: service
  };
  require.cache[require.resolve('../utils/auth')] = {
    id: require.resolve('../utils/auth'),
    filename: require.resolve('../utils/auth'),
    loaded: true,
    exports: auth
  };
  require.cache[require.resolve('../utils/notify')] = {
    id: require.resolve('../utils/notify'),
    filename: require.resolve('../utils/notify'),
    loaded: true,
    exports: notify
  };
  require('../pages/profile-edit/index');
  return page;
}

function flushPromises() {
  return Promise.resolve().then(() => Promise.resolve());
}

async function runSaveSubmitsProfileAndRefreshesStoredUserTest() {
  const calls = [];
  const storedUsers = [];
  const successMessages = [];
  const navigationEvents = [];
  let resolveUpdate;
  const page = loadProfileEditPage({
    navigationEvents,
    service: {
      updateProfile(payload) {
        calls.push(payload);
        return new Promise((resolve) => {
          resolveUpdate = resolve;
        });
      }
    },
    auth: {
      getStoredUser() {
        return {
          id: 2,
          username: 'member_b',
          displayName: '伴侣 B',
          coupleRole: 'girlfriend',
          mood: '想见你',
          bio: '把每一天都写进 Snowlit。'
        };
      },
      setStoredUser(user) {
        storedUsers.push(user);
      }
    },
    notify: {
      showError() {},
      showSuccess(message) {
        successMessages.push(message);
      }
    }
  });

  page.onLoad();
  page.setData({
    form: {
      displayName: ' 伴侣 B2 ',
      mood: ' 想见你 ',
      bio: ' 把每一天都写进 Snowlit。 '
    }
  });
  const savePromise = page.saveProfile();
  page.saveProfile();

  assert.deepEqual(calls, [{
    displayName: '伴侣 B2',
    mood: '想见你',
    bio: '把每一天都写进 Snowlit。'
  }]);
  assert.equal(page.data.saving, true);

  resolveUpdate({
    id: 2,
    username: 'member_b',
    displayName: '伴侣 B2',
    coupleRole: 'girlfriend',
    mood: '想见你',
    bio: '把每一天都写进 Snowlit。'
  });
  await savePromise;
  await flushPromises();

  assert.equal(page.data.saving, false);
  assert.equal(storedUsers[0].displayName, '伴侣 B2');
  assert.equal(page.data.user.displayName, '伴侣 B2');
  assert.deepEqual(successMessages, ['资料已保存']);
  assert.deepEqual(navigationEvents, [{ type: 'navigateBack' }]);
}

async function runBlankDisplayNameDoesNotSubmitTest() {
  const calls = [];
  const errors = [];
  const navigationEvents = [];
  const page = loadProfileEditPage({
    navigationEvents,
    service: {
      updateProfile(payload) {
        calls.push(payload);
        return Promise.resolve({});
      }
    },
    auth: {
      getStoredUser() {
        return { username: 'member_b', displayName: '伴侣 B' };
      },
      setStoredUser() {}
    },
    notify: {
      showError(message) {
        errors.push(message);
      },
      showSuccess() {}
    }
  });

  page.setData({
    form: {
      displayName: ' ',
      mood: '想见你',
      bio: '简介'
    }
  });
  await page.saveProfile();

  assert.deepEqual(calls, []);
  assert.deepEqual(errors, ['请输入昵称']);
  assert.deepEqual(navigationEvents, []);
  assert.equal(page.data.saving, false);
}

async function run() {
  await runSaveSubmitsProfileAndRefreshesStoredUserTest();
  await runBlankDisplayNameDoesNotSubmitTest();
  console.log('profile-edit save tests passed');
}

run().catch((error) => {
  delete global.wx;
  delete global.Page;
  delete global.getApp;
  delete global.getCurrentPages;
  clearModules();
  console.error(error);
  process.exit(1);
});
