var ImapClient = require('emailjs-imap-client').default;
var jsonfile = require('jsonfile');
var utf7 = require('./utf7');
var path = require('path');
var Promise = require("bluebird");

var emailStoreFile = path.join(__dirname, '../data/emailStore.json');

var readStore = function() {
  return new Promise((resolve, reject) => {
    jsonfile.readFile(emailStoreFile, function(err, obj) {
      if (!err) {
        resolve(obj);
      } else {
      	console.log("err " + err);
        resolve({});
      }
    })
  });
}

var saveStore = function (emailStore) {
  return new Promise((resolve, reject) => {
    jsonfile.writeFile(emailStoreFile, emailStore, function (err) {
      if (!err) {
        resolve(emailStore);
      } else {
        reject(err);
      }
    })
  })
}

var foldersCache = {}, foldersCacheTime = {};

String.prototype.hashCode = function() {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

function flattenFolders(node, result = []){
	if(!node.root) {
    	result.push(utf7.imap.decode(node.path));
	}
    node.children.forEach((child) => {
		flattenFolders(child, result);
    })         
    return result;
}

function getClient(account) {
	return readStore()
		.then(store => {
			var client = new ImapClient(store[account].server.host, store[account].server.port, store[account].server.options);
			return client.connect().then(() => {return client;});
		})	
}


function getSubscriptionsIndex(subscriptions, path) {
	return subscriptions.findIndex((item) => {
		return item.path.toLowerCase() === path.toLowerCase();
	});
}

function getSubscriptions(subscriptions, uid) {
	return subscriptions.filter(subscription => {
		return subscription.recipients.includes(uid);
	}).map(subscription => {
		return subscription.path;
	})
}

// TODO
function getRecipients(subscriptions, path) {
	var result = getSubscriptionsIndex(subscriptions, path);
	if (result > -1) {
		return subscriptions[result].recipients;
	} else {
		return [];
	}
}

exports.subscribe = (account, path, uid) => {
	return readStore()
		.then((store) => {

			var index = getSubscriptionsIndex(store[account].subscriptions, path);
			if (index > -1) {
				if (!store[account].subscriptions[index].recipients.includes(uid)) {
					store[account].subscriptions[index].recipients.push(uid);
				}
			} else {
				store[account].subscriptions.push({
					path: path,
					recipients: [uid]
				})
			}
			return saveStore(store);
		})
}


exports.unsubscribe = (account, path, uid) => {
	return readStore()
		.then((store) => {

			var subscriptionIndex = getSubscriptionsIndex(store[account].subscriptions, path);
			if (subscriptionIndex > -1) {
				var index = store[account].subscriptions[subscriptionIndex].recipients.indexOf(uid);
				if (index > -1) {
					store[account].subscriptions[subscriptionIndex].recipients.splice(index, 1);
				} 
			} 
			return saveStore(store);
		})
}

exports.listFolders = (account) => {
	if (!foldersCacheTime[account] || !foldersCache[account] || Date.now() - foldersCacheTime[account]  > 1000 * 60 * 60 * 24) {
		return getClient(account)
			.then(client => {
				return client.listMailboxes()
					.then(mailboxes => {
						var folders =  flattenFolders(mailboxes);	
						return readStore()
							.then(store => {
								if (store[account].excludeFolders && store[account].excludeFolders.length > 0) {
									return folders.filter(folder => {return !store[account].excludeFolders.includes(folder);});
								} else {
									return folders;
								}			

							})
							.then(folders => {
								foldersCache[account] = folders;
								foldersCacheTime[account] = Date.now();		
								return folders;								
							});		
					})
					.finally(() => {
						return client.close();
					});
			})
		
	} else {
		return Promise.resolve(foldersCache[account]);
	}
}

exports.getAccounts = (currentUser) => {
	return readStore()
		.then(store => {
			var accounts = [];
			Object.keys(store).forEach(account => {
				var pushAccount = false;
				if (store[account].shared.users.includes(currentUser.uid)) {
					pushAccount = true;
				} 
				else {
					store[account].shared.groups.forEach(group => {
						if (currentUser.memberGroups.includes(group)) {
							pushAccount = true;
						}
					})
				}
				if (pushAccount) {
					accounts.push({ account : account, subscriptions: getSubscriptions(store[account].subscriptions, currentUser.uid)});
				}
			})
			return accounts;
		})
}


exports.getConfig = () => {
	return readStore();
}



// TODO
exports.checkEmails = (subscriptions) => {
	return this.listFolders()
		.then((folders) => {
			return 	Promise.all(folders.map((folder) => {
				var recipients = getRecipients(subscriptions, folder);
				var client = getClient();
				return client.connect()
					.then(() => {
						return client.search(utf7.imap.encode(folder), { unkeyword: 'mailbot-' + folder.hashCode() }, { byUid: true })
					})
					.then((uids) => {
						if (uids && uids.length > 0) {
							return client.setFlags(utf7.imap.encode(folder), uids.join(','), {add: ['mailbot-' + folder.hashCode()], set: ['mailbot-'+ folder.hashCode()]}, { byUid: true})
							  .then(() => {
							  	if (recipients.length > 0) {
							  		return client.listMessages(utf7.imap.encode(folder), uids.join(','), ['uid', 'flags', 'envelope', 'bodystructure'], { byUid: true});
							  	} else {
							  		return [];
							  	}
							  	
							  })
							
						}				
						else {
							return [];
						}
					})
					.then((messages) => {
						return {folder: {path: folder, recipients: recipients}, messages: messages};
					})
					.finally(() =>  {
						return client.close();
					})
			}));

		})
}