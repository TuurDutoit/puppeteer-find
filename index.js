module.exports = { find, findWhere, install };


function install(page) {
  page.find = find;
  page.findWhere = findWhere;
  return page;
}


////////////////////////////////////////////////////////////////////////////////
// Server (node.js)
////////////////////////////////////////////////////////////////////////////////



function find($root, queries) {
  // No $root, only queries
  if(!queries) {
    queries = $root;
    $root = null;
  }
  
  // One query passed as object
  if(!Array.isArray(queries)) {
    queries = [queries];
  }
  
  // First item in array is $root
  if(queries[0].subtype === 'node') {
    $root = queries.shift();
  }
  
  // Prepare the queries, i.e. deconstruct RegExps
  queries = queries.map(prepareQuery);
  
  // MAGIC!
  return this.evaluateHandle(clientFind, $root, queries);
}


// Shorthand for very common use case
function findWhere($root, selector, where) {
  if(typeof $root === 'string') {
    where = selector;
    selector = $root;
    $root = null;
  }
  
  if(typeof where === 'string') {
    where = {equals: where};
  }
  
  return find.call(this, $root, [{ $: selector, where }]);
}


// Regular Expressions can't be serialized in JSON, so we need to decompose them
function prepareQuery(query) {
  for(let key in query) {
    let val = query[key];
    if(val instanceof RegExp) {
      query[key] = [ val.source, val.flags ];
    }
    else if(typeof val === 'object') {
      prepareQuery(val);
    }
  }
  
  return query;
}



////////////////////////////////////////////////////////////////////////////////
// Browser (Chrome)
////////////////////////////////////////////////////////////////////////////////



function clientFind($root, queries) {
  
  // Because of help texts, alt attributes etc., element.textContent is not very reliable
  // This function simply finds the first non-empty text node
  function textContent($node) {
    if($node.nodeName === '#text' && $node.textContent.trim()) {
      return $node.textContent.trim();
    }
    
    for(let i = 0, len = $node.childNodes.length; i < len; i++) {
      let content = textContent($node.childNodes[i]);
      if(content) {
        return content;
      }
    }
  }
  
  // Handle aliases and some other edge cases
  function prepareClause(clause) {
    clause.contains = clause.contains || clause.includes;
    clause.is = clause.is != null ? clause.is : clause.equals; // Can be the empty string
    clause.matches = clause.matches || clause.match || clause.regex;
    clause.not = clause.not != null ? !!clause.not : clause.exists === false;
    clause.isEmpty = clause.isEmpty != null ? clause.isEmpty : clause.empty;
    
    if(clause.is == null && clause.isEmpty) {
      clause.is = '';
    }
    
    if(clause.matches) {
      // Reconstruct regular expression. Also see prepareQuery()
      clause.matches = new RegExp(...clause.matches);
    }
    
    return clause;
  }
  
  // We allow passing the 'where' filters in the query itself, instead of the 'where' property
  // To avoid checkMatch() querying a second time with the same selector (in the '$' property),
  // This function removes that property from the clause
  function toWhere(query) {
    return Object.assign({}, query, {$: undefined});
  }
  
  // Check whether a given element matches a given clause
  // e.g. <h1>Hello, world</h1> matches { contains: 'world' }
  function checkMatch($elem, clause) {
    clause = prepareClause(clause);
    let $child = clause.$ ? $elem.querySelector(clause.$) : $elem;
    var match = false;
    
    if($child) {
      let text = textContent($child);
      match = (
        (clause.is == null || text === clause.is) &&
        (clause.contains == null || text.includes(clause.contains)) &&
        (clause.matches == null || text.match(clause.matches))
      );
    }
    
    return clause.not ? !match : match;
  }
  
  // Checks whether a given element matches a given 'where' clause
  // Kinda like checkMatch() - which it delegates to
  // But also supports 'and' and 'or' operators (with recursion)
  function checkWhere($elem, where) {    
    return (
      (where.and && where.and.reduce((res, clause) => res && checkWhere($elem, clause), true)) ||
      (where.or && where.or.reduce((res, clause) => res || checkWhere($elem, clause), false)) ||
      (checkMatch($elem, where))
    );
  }
  
  // Finds candidates, and returns the first one that passes the 'where' clause
  function process($elem, query) {
    let $candidates = query.$ ? $elem.querySelectorAll(query.$) : [ $elem ];
    
    for(let i = 0, len = $candidates.length; i < len; i++) {
      let $candidate = $candidates[i];
      
      if(checkWhere($candidate, query.where || toWhere(query))) {
        return $candidate;
      }
    }
    
    // No candidate matched
    return null;
  }
  
  // Loop through queries, going deeper in the DOM tree on every iteration
  let $elem = $root || document;
  for(let i = 0, len = queries.length; i < len; i++) {
    let query = queries[i];
    
    if(typeof query === 'string') {
      query = { $: query };
    }
    
    $elem = process($elem, query);
    
    if(!$elem) {
      return null;
    }
  }
  
  return $elem;
}