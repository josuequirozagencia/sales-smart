// Polyfill para process no browser
if (typeof global === 'undefined') {
  window.global = window;
}

if (typeof process === 'undefined') {
  window.process = {
    env: {},
    version: 'v16.0.0',
    versions: {},
    browser: true,
    release: {},
    platform: 'browser',
    arch: 'browser',
    argv: [],
    pid: 1,
    ppid: 0,
    execPath: '',
    cwd: function() { return '/'; },
    nextTick: function(fn, ...args) {
      return setTimeout(fn.bind(null, ...args), 0);
    }
  };
}

// Polyfill para Buffer se necessário
if (typeof Buffer === 'undefined') {
  window.Buffer = {
    isBuffer: function() { return false; },
    from: function(data) { return data; },
    alloc: function(size) { return new Array(size); }
  };
}