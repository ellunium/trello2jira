# trello2jira
An App to export Trello content in the format of CSV files to be imported to Jira through bulk import.

I created this app because my Jira instance was not updated to a version that has and I needed to migrate/export some content from Trello to Jira and the only way to do it was through CSV. That's why trello2jira was created.

The app will create CSV files from the selected Trello board. Each CSV file represents an open List in the board.

Also, a TXT file will be creaed containing all the labels used in the cards that you might want to create in Jira to map when importing.

**Informsation that will be available in the csv**
- type of the issue: Story
- date created
- date last modified
- summary
- description
  - card description
  - link to original trello card
  - card attachements
  - actions
    - comments
    - attachments
  - components/labels

**How to use it**
  - [Download](https://github.com/ellunium/trello2jira/releases/tag/0.1.0) the latest.
  - Select the board you want to export
  - Map the usernames, so that mentions will also work in Jira. 
    - If your usernames are the same in Trello and Jira, skip this.
  - Select a folder to save the CSV files.
