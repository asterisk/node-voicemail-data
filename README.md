# Asterisk Voicemail Data Access Layer

Data access layer for the Asterisk Voicemail application. This currently supports postgres and sqlite but a provider specific implementation can be provided for other databases.

The module exposes repositories for all resource types needed to interact with a voicemail application. These repositories allow creation of new instances, saving, deleting, getting a single instance or all instances, and other operations specific to a given resource.

# Installation

```bash
$ git clone https://github.com/asterisk/node-voicemail-data.git
$ cd node-voicemail-data
$ npm install -g .
```

or add the following the your package.json file

```JavaScript
"dependencies": {
  "voicemail-data": "asterisk/node-voicemail-data"
}
```

# Usage

```JavaScript
var config = {
  connectionString: 'postgres://user:password@localhost/database',
  provider: 'postgres' // postgres or sqlite
};
var dal = require('voicemail-data')(config);
```

This will expose the following repositories:

```JavaScript
dal.context;
dal.contextConfig;
dal.mailbox;
dal.mailboxConfig;
dal.folder;
dal.message;
```

# Repositories

## Context

create accepts a string containing the name of a domain and returns a new context instance:

```JavaScript
function create(domain) {
}
```

get accepts a string containing the name of a domain and returns an existing context instance:

```JavaScript
function get(domain) {
}
```

save accepts a context instance and persists it to the database:

```JavaScript
function save(context) {
}
```

remove accepts a context instance and deletes it from the database:

```JavaScript
function remove(context) {
}
```

createTable creates a context table in the database:

```JavaScript
function createTable() {
}
```

createIndexes creates indexes for the context table in the database:

```JavaScript
function createIndexes() {
}
```

## Context Config

create accepts a context instance and an object containing fields and returns a new context config instance populated with the provided fields:

```JavaScript
function create(context, fields) {
}
```

all accepts a context instance and returns all existing context config instances:

```JavaScript
function all(context) {
}
```

save accepts a context config instance and persists it to the database:

```JavaScript
function save(contextConfig) {
}
```

remove accepts a context config instance and deletes it from the database:

```JavaScript
function remove(contextConfig) {
}
```

createTable creates a context config table in the database:

```JavaScript
function createTable() {
}
```

createIndexes creates indexes for the context config table in the database:

```JavaScript
function createIndexes() {
}
```

## Mailbox

create accepts a string containing a mailbox number, a context instance, and an object containing fields and returns a new mailbox instance populated with the provided fields:

```JavaScript
function create(number, context, fields) {
}
```

get accepts a string containing a mailbox number and a context instance and returns an existing mailbox instance:

```JavaScript
function get(number, context) {
}
```

save accepts a mailbox instance and persists it to the database:

```JavaScript
function save(mailbox) {
}
```

remove accepts a mailbox instance and deletes it from the database:

```JavaScript
function remove(mailbox) {
}
```

newMessage accepts a mailbox instance and a function to update MWI in Asterisk and updates the mailbox to have 1 more new message (unread). This method is thread safe.

```JavaScript
function newMessage(mailbox, mwi) {
  // 1 will be added to latest count of unread messages and mwi will be called
  // with the latest read/unread counts - mwi(read, unread);
}
```

readMessage accepts a mailbox instance and a function to update MWI in Asterisk and updates the mailbox to have 1 more old message (read) and 1 less new message (unread). This method is thread safe:

```JavaScript
function readMessage(mailbox, mwi) {
  // 1 will be added to latest count of read messages, 1 will be removed from
  // the latest count of unread messages and mwi will be called with
  // the latest read/unread counts - mwi(read, unread);
}
```

deletedMessage accepts a mailbox instance, a boolean determining whether the message had been read at the time of deletion, and a function to update MWI in Asterisk and updates the mailbox read/unread counts accordingly. This method is thread safe:

```JavaScript
function deletedMessage(mailbox, messageRead, mwi) {
}
```

createTable creates a mailbox table in the database:

```JavaScript
function createTable() {
}
```

createIndexes creates indexes for the mailbox table in the database:

```JavaScript
function createIndexes() {
}
```

## Mailbox Config

create accepts a mailbox instance and an object containing fields and returns a new mailbox config instance populated with the provided fields:

```JavaScript
function create(mailbox, fields) {
}
```

all accepts a mailbox instance and returns all existing mailbox config instances:

```JavaScript
function all(mailbox) {
}
```

save accepts a mailbox config instance and persists it to the database:

```JavaScript
function save(mailboxConfig) {
}
```

remove accepts a mailbox config instance and deletes it from the database:

```JavaScript
function remove(mailboxConfig) {
}
```

createTable creates a mailbox config table in the database:

```JavaScript
function createTable() {
}
```

createIndexes creates indexes for the mailbox config table in the database:

```JavaScript
function createIndexes() {
}
```

## Folder

create accepts an object containing fields and returns a new folder instance populated with the provided fields:

```JavaScript
function create(fields) {
}
```

all returns all existing folder instances as an object keyed by the dtmf input used to refer to a folder:

```JavaScript
function all() {
}
```

save accepts a folder instance and persists it to the database:

```JavaScript
function save(folder) {
}
```

remove accepts a folder instance and deletes it from the database:

```JavaScript
function remove(folder) {
}
```

createTable creates a folder table in the database:

```JavaScript
function createTable() {
}
```

createIndexes creates indexes for the folder table in the database:

```JavaScript
function createIndexes() {
}
```

## Message

create accepts a mailbox instance, a folder instance, and an object containing fields and returns a new message instance populated with the provided fields:

```JavaScript
function create(mailbox, folder, fields) {
}
```

all accepts a mailbox instance and a folder instance and returns all existing message instances for that mailbox and folder:

```JavaScript
function all(mailbox, folder) {
}
```

get accepts a message instance and returns that instance with all fields updated to their latest values from the database:

```JavaScript
function get(message) {
}
```

latest accepts a mailbox instance, a folder instance, and a moment object representing the date of the latest message and returns all message instances that are more recent than that latest messsage for the mailbox and folder given:

```JavaScript
function latest(mailbox, folder, latestDate) {
}
```

save accepts a message instance and persists it to the database:

```JavaScript
function save(message) {
}
```

remove accepts a message instance and deletes it from the database. This method is thread safe:

```JavaScript
function remove(message) {
}
```

changeFolder accepts a message instance and a folder instance and moves the message to that folder:

```JavaScript
function changeFolder(message, folder) {
}
```

markAsRead accepts a message instance and updated the message to be marked as read. This method is thread safe:

```JavaScript
function markAsRead(message) {
}
```

createTable creates a message table in the database:

```JavaScript
function createTable() {
}
```

createIndexes creates indexes for the message table in the database:

```JavaScript
function createIndexes() {
}
```

# Development

After cloning the git repository, run the following to install the module and all dev dependencies:

```bash
$ npm install
$ npm link
```

Then run the following to run jshint and mocha tests:

```bash
$ grunt
```

jshint will enforce a minimal style guide. It is also a good idea to create unit tests when adding new features.

Unit test fixtures are stored under test/helpers/fixtures.json and are used to populate the test database before each test runs.

# License

Apache, Version 2.0. Copyright (c) 2014, Digium, Inc. All rights reserved.

