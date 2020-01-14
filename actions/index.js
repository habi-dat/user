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

var execute = async function(action, step, object, currentUser) {
  var responses = await Promise.all(action[step].map(callback => callback(object, currentUser)));
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

var executeAll = async function(action, steps, object, currentUser) {
    var response = {
        status: true,
        responses: []
    };

    for(i=0; i<steps.length; i++) {
      var newResponse = await execute(action, steps[i], object, currentUser);
      flattenResponses(response, newResponse);
      if (!response.status) {
        return response;
      }
    }

    return response;
}

exports.user = {
  create: async function(user, currentUser) {
    return await executeAll(hooks.user.create, ["validate", "pre", "on", "post"], user, currentUser);
  },
  modify: async function(user, currentUser) {
    return await executeAll(hooks.user.modify, ["validate", "pre", "on", "post"], user, currentUser);
  },
  remove: async function(user, currentUser) {
    return await executeAll(hooks.user.remove, ["validate", "pre", "on", "post"], user, currentUser);
  }
};

exports.group = {
  create: async function(group, currentUser) {
    return await executeAll(hooks.group.create, ["validate", "pre", "on", "post"], group, currentUser);
  },
  modify: async function(group, currentUser) {
    return await executeAll(hooks.group.modify, ["validate", "pre", "on", "post"], group, currentUser);
  },
  remove:  async function(group, currentUser) {
    return await executeAll(hooks.group.remove, ["validate", "pre", "on", "post"], group, currentUser);
  }
}

exports.category = {
  create: async function(category, currentUser) {
    return await executeAll(hooks.category.create, ["validate", "pre", "on", "post"], category, currentUser);
  },
  modify: async function(category, currentUser) {
    return await executeAll(hooks.category.modify, ["validate", "pre", "on", "post"], category, currentUser);
  },
  remove:  async function(category, currentUser) {
    return await executeAll(hooks.category.remove, ["validate", "pre", "on", "post"], category, currentUser);
  }
}

exports.setting = {
  modify: async function (setting, currentUser) {
    return await executeAll(hooks.setting.modify, ["validate", "pre", "on", "post"], setting, currentUser);
  },
  fetch: async function(list, currentUser) {
    return await executeAll(hooks.category.modify, ["fetch"], list, currentUser);
  }
}