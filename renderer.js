//require ipcRenderer
const {ipcRenderer} = require('electron')
var request = require("request");
var fs = require('fs')
const path = require("path")

//define some objects
const selectDirBtn = document.getElementById('selectFolder');
const changeFolderBtn = document.getElementById('changeFolder');
const selectedFile = document.getElementById('fileSelected');
const fileSelectedContainer = document.getElementById('fileSelectedContainer');
const noFileSelectedContainer = document.getElementById('noFileSelectedContainer');
const createCSVFilesBT = document.getElementById('createCSVFilesBT');
const saveLocationLabel = document.getElementById('saveLocationLabel');
const selectBoard = document.getElementById('selectBoard');
const selectBoardContainerLabel = document.getElementById('selectBoardContainerLabel');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const trelloApiConnection = document.getElementById('trelloApiConnection');
const noTrelloApiConnection = document.getElementById('noTrelloApiConnection');
const connectedToTrelloLabel = document.getElementById('connectedToTrelloLabel');
const mainCTAContainer = document.getElementById('mainCTAContainer');
const trelloUsers = document.getElementById('trelloUsers');
const jiraUsers = document.getElementById('jiraUsers');
const userNamesContainerlistItem  = document.getElementById('userNamesContainerlistItem');
const trelloUserNamesContainerListItem  = document.getElementById('trelloUserNamesContainerListItem');
const jiraUserNamesContainerListItem  = document.getElementById('jiraUserNamesContainerListItem');

const Trello = require('trello-web')
const trelloObj = new Trello('e2052295e99c66492fad6947bde1119f')

function connectToTrelloApi(){

	Promise.resolve().then(() =>
		localStorage.getItem('token')
	).then(existingToken => {
		if (existingToken) {
			trelloObj.token = existingToken
			global.API_KEY = trelloObj.key
			global.AUTH_TOKEN = trelloObj.token
		} else {
			return trelloObj.auth({
				name: 'Trello 2 Jira',
				scope: {
					read: true,
					write: false,
					account: true
				},
				expiration: '1hour'
			})
		}
	}).then(() =>
		trelloObj.get("/1/tokens/" + trelloObj.token + "/member", {
			fields: 'username,id,email'
		}).then(
			trelloObj.get('/1/members/me/boards').then( boards => {
				selectBoard.options.length = 0
				selectBoard.options[0] = new Option('None', '')

				for(index in boards) {
					selectBoard.options[selectBoard.options.length] = new Option(boards[index].name, boards[index].id);
				}
			}),
			trelloObj.get('/1/members/me/').then( user => {
				userAvatar.src = 'http://trello-avatars.s3.amazonaws.com/' + user.avatarHash + '/50.png';
				userName.innerHTML = user.fullName;
				noTrelloApiConnection.classList.add('hide');
				trelloApiConnection.classList.remove('hide');
				connectedToTrelloLabel.classList.add('match');
			}),
			global.API_KEY = trelloObj.key,
			global.AUTH_TOKEN = trelloObj.token,
		)
	).catch(e => {
		console.log('something bad happened, or the user took too long to authorize.', e)
	})
}

//add event listender to connect to Trello API
connetToTrello.addEventListener('click', (event) => {
	connectToTrelloApi();
})

//add event listener to call the function to return the dialog
selectDirBtn.addEventListener('click', (event) => {
  ipcRenderer.send('open-file-dialog');
})

//add event listener to call the function to return the dialog
changeFolder.addEventListener('click', (event) => {
	ipcRenderer.send('open-file-dialog');
})

//remove CTAs border
window.onscroll = function() {
	var d = document.documentElement;
	var offset = d.scrollTop + window.innerHeight;
	var height = d.offsetHeight;
  
	if (offset === height) {
	  	mainCTAContainer.classList.add('atBottom');
	} else {
		mainCTAContainer.classList.remove('atBottom');
	}
  };

//add event listener to validate selected board
selectBoard.addEventListener('change', (event) => {
	if(selectBoard.value != '') {
		trelloUsers.innerHTML = '';
		jiraUsers.innerHTML = '';
		userNamesContainerlistItem.style.display = 'block';
		trelloUserNamesContainerListItem.style.display = 'block';
		jiraUserNamesContainerListItem.style.display = 'block';
		trelloObj.get('/1/boards/' + selectBoard.value + '/members').then( members => {
			jiraUsersArray = members.map(x => '[~' + x.username + ']');
			global.trelloUsersArray = members.map(x => '@' + x.username);

			trelloUsersArray.forEach(username =>{
				trelloUsers.innerHTML +=`<input type="text" class="control-label usernames trello" maxlength="32" placeholder="${username}" value="${username}" disabled></input>`
			})

			jiraUsersArray.forEach(username =>{
				jiraUsers.innerHTML +=`<input type="text" class="control-label usernames jira" maxlength="32" placeholder="${username}" value="${username}"></input>`
			})

		})
		selectBoardContainerLabel.classList.add('match')
		enableExport();
	} else {
		selectBoardContainerLabel.classList.remove('match')
		userNamesContainerlistItem.style.display = 'none';
		trelloUserNamesContainerListItem.style.display = 'none';
		jiraUserNamesContainerListItem.style.display = 'none';
	}
})

//once a file is selected, show it
ipcRenderer.on('selected-directory', (event, path) => {
  selectedFile.innerHTML = path;
	global.filePath = path;
	noFileSelectedContainer.classList.add('hide');
	fileSelectedContainer.classList.remove('hide');
	saveLocationLabel.classList.add('match');
	enableExport();
})

//out all inputs that have a label to change color on focus in an object
var inputs = document.getElementsByClassName('control-label');

//enable the export button
function enableExport(){
	(selectBoard.value != '' && global.filePath)? createCSVFilesBT.disabled = false : createCSVFilesBT.disabled = 'disabled';
}

//event listener for the Create CSV Button
createCSVFilesBT.addEventListener('click', (event) => {

	if (typeof global.filePath == 'undefined'){

		//show done dialog
		ipcRenderer.send('show-dialog', {
			type: 'info',
			message: 'Please select a board and directory to export.'
		});

	} else {

		//set up the trello call to get all the content from the board
		trelloObj.get("/1/boards/" + selectBoard.value, {
			fields: "id,name",
			lists: "open",
			list_fields: "all",
			actions: "commentCard,addAttachmentToCard",
			action_fields: "all",
			actions_limit: "1000",
			cards: "visible",
			cards_fields: "all",
			card_attachments: "true",
			card_attachment_fields: "all",
			customFields: 'true',
			customFieldItems: 'true',
		}).then( content => {

			//date formarter
			var dateFormat = require('dateformat');
			dateFormat.masks.trelloAction = 'mmm, d "at" h:MM TT';
			dateFormat.masks.dateCreatedModified = 'dd/mm/yy hh:MM';

			//setup main objects
			obj = content
			var cards = obj.cards

			//function to check if array has the value
			function arrayContains(arrayObject, value) {
				for (var i = 0; i < arrayObject.length; i++) {
					if (arrayObject[i].id == value) {
						return true;
						break;
					}
				}
				return false;
			}

			//create the labels array to hold all used labels
			labelsArray = []

			//populate array with used labels from open tickets
			for (n = 0; n < cards.length; n++) {
				cardLabels = cards[n].labels;
				if (!cards.closed) {
					for (m = 0; m < cardLabels.length; m++) {
						if (!labelsArray.includes(cardLabels[m].name)) {
							labelsArray.push(cardLabels[m].name);
						}
					}
				}
			}

			//sort labels aray
			labelsArray.sort();

			//informsation available in the csv
			// - type of the issue: Story
			// - date created
			// - date last modified
			// - summary
			// - description
			//		- card description
			//		- link to original trello card
			//		- card attachements
			//		- actions
			//				- comments
			//				- attachments
			// - components/labels

			//start the headers of the CSV
			var headers = "IssueType;DateCreated;DateLastModified;Summary;Description;";

			//fill the rest of the headers with available components / labels
			for (l = 0; l < labelsArray.length; l++) {
				if (l + 1 == labelsArray.length) {
					headers += "Component\n";
				} else {
					headers += "Component;";
				}
			}

			//define Jira usernames array
			jiraUsersArray = Array.from(document.getElementsByClassName('control-label usernames jira')).map(input => {
				return (input.value == '') ? input.placeholder : input.value;
			});

			//start loop to get the content for each list
			obj.lists.forEach(function(list) {

				//initiate the string that will hold the whole content of the description column
				rows = "";

				//cards
				for (i = 0; i < cards.length; i++) {

					//only get content from opened cards from the same list
					if (cards[i].closed == false && list.id == cards[i].idList) {

						//start the row with the story, dates, summary
						rows += "Story;";

						//add created and modified dates
						var dateCreated = dateFormat(new Date(1000 * parseInt(cards[i].id.substring(0, 8), 16)), "dateCreatedModified");
						var dateLastModified = dateFormat(cards[i].dateLastActivity, "dateCreatedModified");
						rows += dateCreated + ";" + dateLastModified + ";";

						//summary
						rows += cards[i].name.trim() + ";";

						//Since there's a lot of multiline in the description, wrap description with quotes to support multi-line and replace quotes with double quotes
						if (cards[i].desc && cards[i].desc.length > 0) {
							rows += '"';
							rows += cards[i].desc.replace(/"/g, '""');
							rows += "\n\n";
							rows += "----";
							rows += "\n\n";
							rows += "**Original Trello Ticket:**\n";
							rows += "[Click here to see the original ticket in Trello|" + cards[i].url + "]";
							rows += "\n";

							//list of attachements
							if (cards[i].attachments.length > 0) {
								rows += "\n";
								rows += "----";
								rows += "\n\n";
								rows += "**Attachements:**\n";
								cards[i].attachments.forEach(function(attachement) {
									rows += "[" + attachement.name.replace(/"/g, '""') + "|" + attachement.url + "]";
									rows += "\n";
								});
							}

							//actions, comments and attachements
							if (cards[i].badges.comments > 0) {
								rows += "\n";
								rows += "----";
								rows += "\n\n";
								rows += "**Comments:**\n";

								//start loop
								obj.actions.forEach(function(action) {
									if (action.data.card) {
										if (action.data.card.id == cards[i].id) {
											date = dateFormat(action.date, "trelloAction");
											rows += "\n";

											//comments
											if (action.type == "commentCard") {

												//replace single quote with double quotes
												actionContent = action.data.text.replace(/"/g, '""');

												//find blockquotes in the format of ">text" and replace with panels to not conflict with quote inceptions
												actionContent = actionContent.replace(/>((.*)(?:[^\n]+\n))+/g, function(str, offset, s) {
													str = str.replace(/>/g, "");
													if (str.split(/\r\n|\r|\n/).length > 2) {
														return "{panel}\n" + str.replace(/^\s+|\s+$/g, "") + "\n{panel}\n";
													} else {
														return "{panel}" + str.replace(/^\s+|\s+$/g, "") + "{panel}\n";
													}
												});

												//group eventual consecutive panels resulting from the function above into a single panel
												actionContent = actionContent.replace(/{panel}(.*)\n+(.*)(?:[^\n]+\n)+{panel}/g, function(str, offset, s) {
													str = str.replace(/{panel}/g, "");
													str = str.replace(/\n\n/g, "\n");
													return "{panel}\n" + str.replace(/^\s+|\s+$/g, "") + "\n{panel}\n";
												});

												//write row content
												rows += "@" + action.memberCreator.username + " on " + date + " :\n";
												rows += "{quote}";
												rows += actionContent;
												rows += "{quote}";
												rows += "\n";

											}

											//attachments
											else if (action.type == "addAttachmentToCard") {
												actionContent = "!" + action.data.attachment.previewUrl + "|width=200px!";

												//write row content
												rows += "@" + action.memberCreator.username + " attached [" + action.data.attachment.name + "|" + action.data.attachment.url + "] on " + date + " :\n";
												rows += "{quote}";
												rows += actionContent;
												rows += "{quote}";
												rows += "\n";
											}
										}
									}
								});
							}

							rows += '";';
						} else {
							rows += ";";
						}

						//get the card labels
						cardLabels = cards[i].labels;

						//add label if any, and empty placeholder if not, this way all components remains in the same place for all rows, which is a Jira requirement
						for (k = 0; k < labelsArray.length; k++) {
							for (j = 0; j < cardLabels.length; j++) {
								if (cardLabels[j].name == labelsArray[k]) {
									rows += cardLabels[j].name;
								}
							}
							if (k != labelsArray.length - 1) rows += ";";
						}
						rows += "\n";
					}
				}

				//clean-up the text from trello to Jira's formatting
				rows = rows.replace(/\*\*(.*?)\*\*/g, "<bold>$1<bold>");
				rows = rows.replace(/\*(.*?)\*/g, "_$1_");
				rows = rows.replace(/<bold>(.*?)<bold>/g, "*$1*");
				rows = rows.replace(/\[(.*?)]\((.*?)\)/g, "[$1|$2]");
				rows = rows.replace(/```([\S\s]*?)```/g, function(str, offset, s) {
					str = str.replace(/```/g, "");
					if (str.split(/\r\n|\r|\n/).length > 2) {
						return "{noformat}\n" + str + "\n{noformat}";
					} else {
						return "{{" + str + "}}";
					}
				});

				//replace the usernames to make compatible Jira mentions
				global.trelloUsersArray.forEach((username, index) => {
					var regex = new RegExp(username, "g");
					rows = rows.replace(regex, jiraUsersArray[index]);
				});

				//write CSV file
				fs.writeFile(global.filePath + '/trello2Jira-' + list.name.replace(/[^A-z\s\d][\\\^]?/g, '') + '.csv', headers + rows, 'utf8', function(err) {
					if (err) {
						console.log('Some error occured - file either not saved or corrupted file saved.');
					} else {
						console.log('File trello2Jira-' + list.name.replace(/[^A-z\s\d][\\\^]?/g, '') + '.csv saved.');
					}
				});

			});

			//write txt file with labels
			fs.writeFile(global.filePath + '/trello2Jira-list-of-labels-or-components.txt', labelsArray, 'utf8', function(err) {
				if (err) {
					console.log('Some error occured - file either not saved or corrupted file saved.');
				} else {
					console.log('File trello2Jira-list-of-labels-or-components.txt saved!');
				}
			});

			//show done dialog
			ipcRenderer.send('show-dialog', {
				type: 'info',
				message: 'Your Trello board has been exported',
				filePath: String(global.filePath[0])
			});
		})

	}

})
