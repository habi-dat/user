var config    = require('../config/config.json');
var request = require('request-promise');
var querystring = require('query-string');
var Promise = require("bluebird");

var buildOptions = function(method, url, parameters = undefined) {
  var options = {
    method: method,
    uri: config.discourse.APIURL + '/' + url + '?api_key=' + config.discourse.APIKEY + '&api_username=' + config.discourse.USERNAME,    
    headers: {
        'User-Agent': 'habiDAT-User-Module'
    },
    json: true
  }
  if (parameters && method == 'GET') {
    options.uri += querystring.stringify(parameters)
  } else if (parameters) {
    options.form = parameters;
  }
  return options;
}

exports.put = function(url, parameters) {
  return request(buildOptions('PUT', url, parameters));
}

exports.get = function(url, parameters) {
  return request(buildOptions('GET', url, parameters));
};

exports.del = function(url, parameters) {
  return request(buildOptions('DELETE', url, parameters));
};

exports.post = function(url, parameters) {
  return request(buildOptions('POST', url, parameters));
};

Array.prototype.insensitiveIndexOf = function (searchElement, fromIndex) {
    return this.map(function (value) {
        return value.toLowerCase();
    }).indexOf(searchElement.toLowerCase(), fromIndex);
};

exports.getCategory = function(id) {
    return exports.get('c/' + id + "/show.json")
        .then(categoryObject => {
            categoryObject.category.groups = categoryObject.category.group_permissions.map((groupPermission) => {
                if (groupPermission.permission_type == 1) {
                    return groupPermission.group_name;
                }
            })
            if (categoryBody.category.uploaded_logo) {
                categoryBody.category.image = config.discourse.APIURL + '/' + categoryBody.category.uploaded_logo.url;
            }            
            return categoryObject.category;
        })
};

exports.getCategoryWithParent = function(id) {
    return Promise.join(exports.get('categories_and_latest'), exports.getCategory(id),
        (categoriesObject, category) => {
            category.parent = categoriesObject.category_list.categories.find(topCategory => {
                return topCategory.subcategory_ids && topCategory.subcategory_ids.includes(category.id);
            });
            return category;
        });
};


exports.getCategories = function(done) {

    exports.get('categories_and_latest')
        .then(categoriesObject => {
            var categoryIDs =[];
            categoriesObject.category_list.categories.forEach(topCategory => {
              categoryIDs.push({parent: null, id: topCategory.id});
                if (topCategory.subcategory_ids) {
                    topCategory.subcategory_ids.forEach(function(subcategory) {
                        categoryIDs.push({parent: topCategory.id, id: subcategory});
                    });
                }                
            })
            return Promise.all(categoryIDs.map(categoryId => {
                return exports.getCategory(categoryId.id)
                    .then(category => {
                        category.parent = categoryId.parent;
                    })
                }))
        })
        .then(categories => {
            // make tree out of flat list
            return categories
                .filter(category => { return category.parent == null })
                .map(rootCategory => {
                    rootCategory.subCategories = categories.filter(category => { return category.parent && category.parent === rootCategory.id });
                    return rootCategory;
                })
        });
};


exports.getParentCategories = function(done) {
    exports.get('categories_and_latest')
        .then(categoriesObject => { return categoriesObject.category_list.categories; });
};

