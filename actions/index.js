var discourse = require('./discourse');
var nextcloud = require('./nextcloud');
var ldap = require('./ldap');
var validate = require('./validate');
var email = require('./email');
var Promise = require('bluebird');

// define hooks - see hooks.md
var hooks = {
  user : {
    create : {
      validate : [], pre: [], on: [], post: []
    },
    modify : {
      validate : [], pre: [], on: [], post: []
    },
    remove : {
      validate : [], pre: [], on: [], post: []
    }
  } ,
  group : {
    create : {
      validate : [], pre: [], on: [], post: []
    },
    modify : {
      validate : [], pre: [], on: [], post: []
    },
    remove : {
      validate : [], pre: [], on: [], post: []
    }
  } ,
  category : {
    create : {
      validate : [], pre: [], on: [], post: []
    },
    modify : {
      validate : [], pre: [], on: [], post: []
    },
    remove : {
      validate : [], pre: [], on: [], post: []
    }
  } ,
  setting : {
    modify : {
      validate : [], pre: [], on: [], post: []
    },
    list : {
      fetch : []
    }
  } ,
};

// register hooks
validate.register(hooks);
ldap.register(hooks);
discourse.register(hooks);
nextcloud.register(hooks);
email.register(hooks);

var execute = async function(action, step, object) {
  var responses = await Promise.all(action[step].map(callback => callback(object)));
  var status = true;
  responses.forEach(function(response) {
    status = response.status && status;
  });
  return {status:status, responses:responses};
}

var flattenResponses = function(response, newResponse) {
  response.status = response.status && newResponse.status;
  response.responses = response.responses.concat(newResponse.responses);
};

var executeAll = async function(action, steps, object) {
    var response = {
        status: true,
        responses: []
    };

    for(i=0; i<steps.length; i++) {
      var newResponse = await execute(action, steps[i], object);
      flattenResponses(response, newResponse);
      if (!response.status) {
        return response;
      }
    }

    return response;
}

exports.user = {
  create: async function(user) {
    return await executeAll(hooks.user.create, ["validate", "pre", "on", "post"], user);
  },
  modify: async function(user) {
    return await executeAll(hooks.user.modify, ["validate", "pre", "on", "post"], user);
  },
  remove: async function(user) {
    return await executeAll(hooks.user.remove, ["validate", "pre", "on", "post"], user);
  }
};

exports.group = {
  create: async function(group) {
    return await executeAll(hooks.group.create, ["validate", "pre", "on", "post"], group);
  },
  modify: async function(group) {
    return await executeAll(hooks.group.modify, ["validate", "pre", "on", "post"], group);
  },
  remove:  async function(group) {
    return await executeAll(hooks.group.remove, ["validate", "pre", "on", "post"], group);
  }
}

exports.category = {
  create: async function(category) {
    return await executeAll(hooks.category.create, ["validate", "pre", "on", "post"], category);
  },
  modify: async function(category) {
    return await executeAll(hooks.category.modify, ["validate", "pre", "on", "post"], category);
  },
  remove:  async function(category) {
    return await executeAll(hooks.category.remove, ["validate", "pre", "on", "post"], category);
  }
}

exports.setting = {
  modify: async function (setting) {
    return await executeAll(hooks.setting.modify, ["validate", "pre", "on", "post"], setting);
  },
  fetch: async function(list) {
    return await executeAll(hooks.category.modify, ["fetch"], list);
  }
}