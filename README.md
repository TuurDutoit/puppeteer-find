Find for Puppeteer
==================
Simple yet powerful DOM querying API

## Overview
All functionality is exposed in one function: `find([ElementHandle $root], Array<Query> queries, [boolean returnId])`.  
Let's take a closer look at those parameters.

* `$root`: an optional ElementHandle that serves as the root of the search. When left out, the `document` will be used.
* `returnId`: because Puppeteer doesn't support returning HTML elements (yet?), we just assign an ID to the resulting element (if it doesn't already have one) and return that. When `returnId` is set to `true`, `find()` will just return that ID. When `false`, it will do an extra query and return the ElementHandle corresponding to the resulting element.
* `queries`: this is the heart of the module, the place where all magic happens. `queries` is an array of Query objects, which consist of a selector and a `where` clause, containing some conditions.