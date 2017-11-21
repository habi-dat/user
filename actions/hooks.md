# HOOKS #

hooks define (almost) all actions in this app. The hooks tree stores functiosn that are executed when the action is triggered. Every hook function
receives an object and returns a response object (status, message). 

## user ##

* user.create:
** user object: given name, surname, project, e-mail, send activation, password, password repeat, member [list of group uids], owner [list of group uids]
** steps: validate, pre, on, post
* user.modify:
** user object: uid, given name, surname, project, e-mail, password, password repeat, member [list of group uids], owner [list of group uids]
** steps: validate, pre, on, post
* user.remove:
** user object: dn
** steps: validate, pre, on, post

## group ##

* group.create:
** group object: uid/name, description
** steps: validate, pre, on, post
* group.modify:
** group object: uid/old name, uid/name, description
** steps: validate, pre, on, post
* group.remove:
** group object: uid/name
** steps: validate, pre, on, post

## category ##

* category.create:
** category object: uid/name, logo, parent category (uid/name), color, groups [list of group names/uids]
** steps: validate, pre, on, post
* category.modify:
** category object: old uid/name, logo, parent category (uid/name), color, groups [list of group names/uids]
** steps: validate, pre, on, post
* category.remove:
** category object: uid/name
** steps: validate, pre, on, post

## settings ##

* settings.modify.{module}:
** setting object: module, setting id, data type, label}, value
** steps: validate, pre, on, post

* settings.list:
** settings list (array to push setting definitions to): module, setting id, data type, label, options (optional), value
** steps: fetch