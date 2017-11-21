var config    = require('../config/config.json');
var discourse = require('discourse-api');

var client = new discourse(config.discourse.APIURL, config.discourse.APIKEY, config.discourse.USERNAME);

Array.prototype.insensitiveIndexOf = function (searchElement, fromIndex) {
    return this.map(function (value) {
        return value.toLowerCase();
    }).indexOf(searchElement.toLowerCase(), fromIndex);
};

exports.getCategory = function(id, done) {
    client.get('c/' + id + "/show.json", {}, function (error, body, httpCode) {
        if (httpCode == "200") {
            var categoryBody = JSON.parse(body);
            //console.log("category body: " + JSON.stringify(categoryBody));
            var groups = [];
            if (categoryBody.category.group_permissions) {
                categoryBody.category.group_permissions.forEach(function(group_permission) {
                    if (group_permission.permission_type == 1) {
                        groups.push(group_permission.group_name);    
                    }
                    
                });
            }
            var image = null;
            if (categoryBody.category.uploaded_logo) {
                image = config.discourse.APIURL + '/' + categoryBody.category.uploaded_logo.url;
            }
            done(null, {
                id: categoryBody.category.id,
                name: categoryBody.category.name,
                slug: categoryBody.category.slug,
                groups: groups,
                logo: categoryBody.category.uploaded_logo,
                image: image,
                background: categoryBody.category.uloaded_background,
                color: categoryBody.category.color,
                parent: null, // is not sent by Discourse, but is set in getCategories, see below
                position: categoryBody.category.position
            });
        } else {
            done("Discourse API: Error fetching category: " + httpCode + " " + error);
        }
    });
};

exports.getCategoryWithParent = function(id, done) {
    client.get('categories_and_latest', {}, function (error, body, httpCode) {
        if (httpCode == "200") {
            var categories_and_latest = JSON.parse(body);
            var topCategories = categories_and_latest.category_list.categories;
            exports.getCategory(id, function(err, category) {

                if (err) {
                    return done(err);
                }

                topCategories.forEach(function(topCategory) {
                    if (topCategory.subcategory_ids && topCategory.subcategory_ids.indexOf(category.id) > -1) {
                        category.parent=topCategory.id;
                    }
                });

                done(null, category);
            });   
        } else {
            done("Discourse API: Error fetching category: " + httpCode + " " + error);
        }
    });
};


exports.getCategories = function(done) {

    var async = require('async');

    client.get('categories_and_latest', {}, function (error, body, httpCode) {
        if (httpCode == "200") {
            var categories_and_latest = JSON.parse(body);
            var topCategories = categories_and_latest.category_list.categories;
            var categoryIDs =[];
            var categories= [];
            var started = 0;
            var finished = 0;
            topCategories.forEach(function(topCategory) {
                started++;
                categoryIDs.push({parent: null, id: topCategory.id});
                if (topCategory.subcategory_ids) {
                    topCategory.subcategory_ids.forEach(function(subcategory) {
                        categoryIDs.push({parent: topCategory.id, id: subcategory});
                    });
                }

            });
            async.each(categoryIDs, function(cat, done) {
                exports.getCategory(cat.id, function(err, category) {
                    //console.log("category: " + JSON.stringify(category));
                    category.parent = cat.parent;
                    categories.push(category);
                    done(err);
                });
            }, function(err) {
                categories.sort(function(a,b){
                    if (a.parent === null && b.parent !== null) {
                        return -1;
                    } else if (b.parent === null && a.parent !== null) {
                        return 1;
                    } else {
                        return a.position-b.position;;
                    }
                });

                // make tree out of flat array
                var categoryTree = [];
                categories.forEach(function (category) {
                    if (category.parent === null) {
                        // create subcategories array and push parent category to tree
                        category.subCategories = [];
                        categoryTree.push(category);
                    } else {
                        // find parent category an push into subCategories array
                        var parent = categories.find(function(cat) {
                            return cat.id === category.parent;
                        })
                        if (parent) {
                            parent.subCategories.push(category);7
                        }
                    }
                });
                //console.log("categories: " + JSON.stringify(categoryTree));
                done(err, categoryTree);
            });
        }
        else {
            done("Discourse API: Error fetching categories: " + httpCode + " " + error);
        }
    });   
};


exports.getParentCategories = function(done) {

    var async = require('async');

    client.get('categories_and_latest', {}, function (error, body, httpCode) {
        if (httpCode == "200") {
            var categories_and_latest = JSON.parse(body);
            var topCategories = categories_and_latest.category_list.categories;
            var categories= [];
            topCategories.forEach(function(topCategory) {
                categories.push({name: topCategory.name, id: topCategory.id});
            });
            done(null, categories);
        }
        else {
            done("Discourse API: Error fetching parent categories: " + httpCode + " " + error);
        }
    });   
};

exports.createCategory = function(category, done) {
    var post = {
        name: category.name,
        slug: '',
        color: category.color.substring(1,7),
        text_color: "FFFFFF",
        parent_category_id: '',
        uploaded_logo_id: '',
        allow_badges:true,
        topic_template: '',
        sort_order: '',
        topic_featured_link_allowed:true
    }
    if (category.parent && category.parent !== -1) {
        post.parent_category_id = category.parent;
    }
    if (category.groups && Array.isArray(category.groups)) {
        category.groups.forEach(function(group) {
            post['permissions[' + group +']'] = 1;
        });
    }

    if (category.logo && category.logo.path && category.logo.path !="") {
        exports.uploadFile(category.logo, function(err, file) {
            if (err) {
                done(err);
            } else {
                post.uploaded_logo_id = retFile.id;
                console.log('category to create: ' + JSON.stringify(post));
                client.post('categories', post, function(error, body, httpCode) {
                    console.log('Category ' + category.name + ' created: ' + JSON.stringify(body) + ' httpCode: ' + httpCode);
                    if (httpCode != "200") {
                        done('Invalid server response ' + httpCode + ': ' + error);
                    } else {
                        done(error);
                    }
                  }
                );  
            }

        });
    } else {

        console.log('category to create: ' + JSON.stringify(post));

        client.post('categories', post, function(error, body, httpCode) {
            console.log('Category ' + category.name + ' created: ' + JSON.stringify(body) + ' httpCode: ' + httpCode);
            if (httpCode != "200") {
                done('Invalid server response ' + httpCode + ': ' + error);
            } else {
                done(error);
            }
          }
        );  
    }
};

exports.deleteCategory = function(id, done) {
    client.delete('categories/'+id, {}, function (error, body, httpCode) {
        done(error);
    });    
};

exports.uploadFile = function(file, done) {

    client.post('uploads.json', {type:'composer', 'files[]':file.path, synchronous:true}, function (error, body, httpCode) {
        console.log('File uploaded: ' + JSON.stringify(body) + ' httpCode: ' + httpCode);
        if (httpCode != "200") {
            done('Invalid server response at file upload ' + httpCode + ': ' + error);
        } else {
            done(error, {id: body.id, url: body.url});
        }
    });    
};