function Transcript(callbacks){
  var self = this;
  self.result_history = [];
  self.display_limit = 30;
  self.current_pagination = 0;
  self.transcript = [];
  self.callbacks = callbacks;
  self.action_icons = {
    SEARCH: { name: 'fa-search', unicode: '\uf002' },
    PIVOT: { name: 'fa-code-fork', unicode: '\uf126' },
    SCOPE: { name: 'fa-binoculars', unicode: '\uf1e5' },
    FAVORITE: { name: 'fa-heart', unicode: '\uf004' },
    TAG: { name: 'fa-hashtag', unicode: '\uf292' },
    NOTE: { name: 'fa-pencil', unicode: '\uf040' },
    END: { name: 'fa-check', unicode: '\uf00c' }
  };
  //self.analysis_tree = new AnalysisTree();
  self.nodes = [];
  self.links = [];

  // Load initial values from ELSA
  $.get('transcript', null, function(data, status, xhr){
    //data = JSON.parse(data);

    console.log('data', data);
    // Server gives the data in reverse order
    for (var i = data.length - 1; i >= 0; i--){
      var datum = data.pop();
      self.transcript.push(datum);
      self.update_analysis(datum);
    }
    self.render();
    self.visualize('#viz_container');
    self.callbacks.finished.bind(self).call();
  }, 'json');
}

Transcript.prototype.update_analysis = function(data){
  var self = this;
  self.nodes.push({
    name: data.action + ' ' + data.description,
    data: data
  });
  if (data.ref_id){
    console.log('data has ref_id', data.id, data.ref_id);
    var source;
    for (var i = 0, len = self.nodes.length; i < len; i++){
      if (self.nodes[i].data.id === data.ref_id){
        source = i;
        break;
      }
      else { console.log(self.nodes[i].data.id + ' was not ' + data.ref_id)}
    }
    // if (typeof(data.referenced_search_description) !== 'undefined')
    //   source = data.referenced_search_description;
    // else
    //   source = self.get_id(data.ref_id).description;
    if (typeof(source) !== 'undefined'){
      console.log('linking ', source, (self.transcript.length - 1));
      console.log('linking', JSON.stringify(self.links));
      self.links.push({
        source: source,
        target: self.nodes.length - 1,
        value: 1
      });
    }
    else { console.log('no source for ref_id ' + data.ref_id)}
  }
  // if (data.scope_id){
  //   console.log('data has scope_id', data);
  //   var source = undefined;
  //   for (var i = 0, len = self.nodes.length; i < len; i++){
  //     if (self.nodes[i].data.action === 'SCOPE' && 
  //       self.nodes[i].data.scope_id === data.scope_id){
  //       source = i;
  //       console.log('found source ' + i);
  //       break;
  //     }
  //   }
  //   if (typeof(source) !== 'undefined'){
  //     console.log('linking ', source, (self.transcript.length - 1));
  //     console.log('linking', JSON.stringify(self.links));
  //     self.links.push({
  //       source: source,
  //       target: self.nodes.length - 1,
  //       value: 1
  //     });
  //   }
  // }
  
  // if (data.action === 'PIVOT') new_branch = true;
  // self.analysis_tree.propagate(data.action + ' ' + data.value, data, new_branch);
};

Transcript.prototype.visualize = function(dom_element){
  if (!dom_element) dom_element = '#viz_container';
  console.log('visualizing');
  var self = this;
   var width = 960,
     height = 500

  var svg = d3.select(dom_element).append("svg")
    .attr('id', 'transcript_graph')
    .attr("width", width)
    .attr("height", height);    

  console.log('calculated width', width, 'height', height);
  
  var force = d3.layout.force()
    //.gravity(0.03)
    .distance(100)
    .charge(-300)
    .size([width, height]);
  
  force
    .nodes(self.nodes)
    .links(self.links)
    .start();

  var link = svg.selectAll(".link")
    .data(self.links)
    .enter().append("line")
    .attr("class", "link");

  var node = svg.selectAll(".node")
    .data(self.nodes)
    .enter().append("g")
    .attr("class", "node")
    .on('click', function(d){ 
      console.log('clicked', d);
      if (d.data.action === 'SEARCH'){
        self.load_item.bind([self, d.data]).call();
      }
    })
    .on('mouseover', function(d){
      d3.select(this).style({'text-shadow': '0 0 5px gold', cursor:'pointer'});
    })
    .on('mouseout', function(d){
      d3.select(this).style({'text-shadow': 'inherit', cursor:'inherit'});
    })
    .call(force.drag);

  node.append('circle')
    .attr('r', 20);
  // node.append("i")
  //   .attr("class", function(d){ console.log(d); return 'fa ' + self.action_icons[d.data.action] + ' fa-fw' })
  //   .attr("x", -8)
  //   .attr("y", -8)
  //   .attr("width", 16)
  //   .attr("height", 16);

  node.append('text')
    .attr('font-family', 'FontAwesome')
    .attr('font-size', '20px')
    .attr('dx', -10)
    .attr('dy', 8)
    .text(function(d) { return self.action_icons[d.data.action].unicode });

  node.append("text")
    .attr("dx", 12)
    .attr("dy", ".35em")
    .text(function(d) { return d.data.description });
  
  force.on("tick", function(e) {
    // Push different nodes in different directions for clustering.
    var k = 6 * e.alpha;
    self.nodes.forEach(function(o, i) {
      if (o.y - (2 * k) < 0) return;
      // Make nodes gravitate in a hierarchy with SCOPE on top
      if (o.data.action === 'SCOPE') o.y -= (2 * k);
      else if (o.data.action === 'PIVOT') o.y -= k;
      else o.y += k;
    });

  node.attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; });

    link.attr("x1", function(d) { return d.source.x; })
    .attr("y1", function(d) { return d.source.y; })
    .attr("x2", function(d) { return d.target.x; })
    .attr("y2", function(d) { return d.target.y; });

    node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
  });

};

Transcript.prototype.counter = function(){
  return this.result_history.length;
};

Transcript.prototype.log_query = function (data){
  this.result_history.push(data);
};

Transcript.prototype.update = function(action, data, cb){
  var self = this;
  // Searches are automatically added to the transcript server-side
  if (action === 'SEARCH'){
    console.log('search update data', data);
    self.log_query(data);
    var datum = {
      id: data.transcript_id, 
      action: action, 
      description: data.description, 
      results_id: data.results_id,
      ref_id: data.ref_id,
      scope_id: data.scope_id
    };
    self.transcript.push(datum);
    self.update_analysis(datum);
    self.render();
  }
  else {
    if (action === 'END' && !data.ref_id) throw Error('Need a ref_id for END');
    console.log('put transcript', data);
    //var put_data = { action:action, scope:data.scope };
    data.action = action;
    if (typeof(data.results_id) !== 'undefined') data.results_id = data.results_id;
    if (typeof(data.data) !== 'undefined') data.data = JSON.stringify(data.data);
    // Write to the server
    $.ajax('transcript', {
      method: 'PUT',
      data: data, 
      success: function(data, status, xhr){
        console.log(data, status);
        self.transcript.push(data);
        self.update_analysis(data);
        if (data.action === 'PIVOT') self.set_current_pivot(data.description);
        else if (data.action === 'SCOPE') self.set_current_scope(data.description);
        self.render();
        if (cb) cb(null, data);
      }
    }).fail(function(e){
      console.error(e);
      var errstr = 'Unable to update transcript';
      console.error(errstr);
      self.callbacks.error(errstr);
      if (cb) cb(errstr);
    });
  }
  
  return action + ' ' + data.description;
}

// Transcript.prototype.update_checked = function(results_id){
//   var self = this;
//   for (var i = 0, len = self.transcript.length; i < len; i++){
//     var item = self.transcript[i];
//     if 
// }

Transcript.prototype.get_id = function(id){
  var self = this;
  for (var i = 0, len = self.transcript.length; i < len; i++){
    if (self.transcript[i].id === id) return i;
  }
  throw Error('Id ' + id + ' not found.');
};

Transcript.prototype.latest = function(action){
  var self = this;
  // Work backwards through the transcript until we find the first instance of what
  // we're looking for.
  for (var i = self.transcript.length - 1; i >= 0; i--){
    if (self.transcript[i].action === action){
      if (action === 'SCOPE' && self.transcript[i].description === 'default') return;
      //if (action === 'PIVOT' && self.transcript[i].visible === false) return;
      return self.transcript[i];
    }
    else if (self.transcript[i].action === 'END'){
      var ended = self.transcript[ self.get_id(self.transcript[i].ref_id) ];
      if (action === 'PIVOT'){
        // See if this END action ended a pivot
        if (ended.action === 'PIVOT') return;
      }
      if (action === 'SCOPE'){
        // See if this END action ended a scope
        if (ended.action === 'SCOPE') return;
      }
    }
  }
};

Transcript.prototype.hide_item = function(item){
  var self = this;
  $.post('transcript', {action:'HIDE', id:item.id}, function(e){
    var item = this;
    item.visible = 0;
    self.render();
    self.callbacks.notify('Transcript ' + item.id + ' hidden');
  }.bind(item)).fail(function(e){
    console.error(e);
    var errstr = 'Unable to set visibility';
    console.error(errstr);
    self.callbacks.error(errstr);
  });
};

// Not a standard method, this is expected to be called with a .bind([self,item])
Transcript.prototype.load_item = function(e){
  console.log('load_item this', this);
  if (!this.length === 2) throw Error('load_item called without bind([self,item])');
  var self = this[0];
  var item = this[1];
  if (e && e.hasOwnProperty('preventDefault')) e.preventDefault();
  self.selected = item.results_id;
  $.get('results/' + item.results_id, null, 
    function(data, status, xhr){ render_search_result(data, status); self.render(); }, 'json')
  .fail(function(e){
    console.error(e);
    var errstr = 'Unable to get result';  
    console.error(errstr);
    self.callbacks.error(errstr);
  });
};

Transcript.prototype.set_current_scope = function(scope){
  var self = this;
  console.log('scope: ' + scope);
  $('#scope_container').empty();
  
  var span = document.createElement('div');
  $(span).text('SCOPE: ');
  $(span).addClass('respect-whitespace');
  $(span).attr('style', 'float: left; color: steelblue;');
  $('#scope_container').append(span);

  span = document.createElement('div');
  $(span).text(scope);
  $(span).attr('style', 'float: left;');
  $('#scope_container').append(span);

  var i = document.createElement('i');
  $(i).addClass('fa fa-close fw');
  $(i).attr('style', 'float: left; margin-left: 5px;');
  $(i).click(function(e){
    e.preventDefault();
    self.end_current_scope();
  });
  $('#scope_container').append(i);

}

Transcript.prototype.end_current_scope = function(){
  var self = this;
  var scope = self.latest('SCOPE');
  if (!scope) return;
  var ref_id = scope.id;
  var search = self.latest('SEARCH');
  console.log('latest search', search);
  if (search && search.scope_id === scope.scope_id)
    ref_id = search.id;
  self.update('END', {
    description: scope.action + ' ' + scope.description,
    scope_id: scope.scope_id,
    ref_id: ref_id
  }, function(err, data){
    if (err) return;
    self.update('SCOPE', { description: 'default', data: { value: 'default' }},
      function(err, data){ $('#scope_container').empty(); });
  });
}

Transcript.prototype.set_current_pivot = function(action){
  var self = this;
  console.log('action: ' + action);
  $('#action_container').empty();
  
  var span = document.createElement('div');
  $(span).attr('style', 'float:left; color:steelblue;');
  $(span).addClass('respect-whitespace');
  $(span).text('PIVOT: ');
  $('#action_container').append(span);

  span = document.createElement('div');
  $(span).attr('style', 'float:left;');
  $(span).text(action);
  $('#action_container').append(span);

  var i = document.createElement('i');
  $(i).addClass('fa fa-close fw');
  $(i).attr('style', 'float:left; margin-left: 5px;');
  $(i).click(function(e){
    e.preventDefault();
    self.end_current_pivot();
  });
  $('#action_container').append(i);
}

Transcript.prototype.end_current_pivot = function(){
  var self = this;
  var scope = self.latest('SCOPE');
  var scope_id = scope ? scope.scope_id : 1;
  var pivot = self.latest('PIVOT');
  if (!pivot) return;
  console.log('ending pivot: ' + pivot.id + ' ' + pivot.description);
  var ref_id = pivot.id;
  var search = self.latest('SEARCH');
  if (search && search.scope_id === scope_id)
    ref_id = search.id;

  // Set pivot to none
  self.update('END', {
    description: pivot.action + ' ' + pivot.description,
    scope_id: scope_id,
    ref_id: ref_id
  }, function(err, data){
    if (err) return;
    console.log('end_current_pivot', err, data);
    $('#action_container').empty();
  });
}

Transcript.prototype.render = function(){
  var self = this;

  // Set latest scope
  var latest_scope = self.latest('SCOPE');
  if (latest_scope && latest_scope.visible){
    self.set_current_scope(latest_scope.description);
  }
  // Set latest pivot
  var latest_pivot = self.latest('PIVOT');
  if (latest_pivot && latest_pivot.visible){
    self.set_current_pivot(latest_pivot.description);
  }
  $('#transcript_container').empty();
  //$('#transcript_container').addClass('respect-whitespace');
  var h1 = document.createElement('span');
  $(h1).addClass('sidebar_title');
  h1.innerText = 'Transcript';
  $('#transcript_container').append(h1);
  // Pagination controls
  var up = document.createElement('i');
  $(up).addClass('fa fa-arrow-up fa-fw');
  $(up).click(function(){
    if (self.current_pagination - self.display_limit >= 0){
      self.current_pagination -= self.display_limit;
      self.render();
    }
  });
  $('#transcript_container').append(up);

  var down = document.createElement('i');
  $(down).addClass('fa fa-arrow-down fa-fw');
  $(down).click(function(){
    if (self.current_pagination + self.display_limit <= self.transcript.length){
      self.current_pagination += self.display_limit;
      self.render();
    }
  });
  $('#transcript_container').append(down);

  var hr = document.createElement('hr');
  $(hr).addClass('sidebar_title');
  $('#transcript_container').append(hr);
  var table = document.createElement('table');
  var tbody = document.createElement('tbody');
  
  var starting_index = Math.max(self.transcript.length - self.display_limit, 0);
  if (self.current_pagination)
    starting_index = self.current_pagination;
  console.log(starting_index, Math.min(self.display_limit + starting_index, 
    self.transcript.length), self.transcript.length);
  
  for (var i = starting_index, 
    len = Math.min(self.display_limit + starting_index, 
      self.transcript.length); i < len; i++){
    var item = self.transcript[i];
    if (item.visible === 0) continue;
    // if (item.action === 'PIVOT') indent_level++;
    var row = document.createElement('tr');
    var cell = document.createElement('td');
    $(cell).attr('data_field', 'transcript_id');
    $(cell).attr('data_value', item.id);
    // var tabs = '';
    // for (var j = 0, jlen = indent_level; j < jlen; j++){
    //   tabs += '    ';
    // }
    
    if (typeof(self.action_icons[item.action]) === 'undefined')
      throw Error('Invalid action ' + item.action);
    var icon = document.createElement('i');
    $(icon).addClass('fa ' + self.action_icons[item.action].name + ' fa-fw');
    cell.appendChild(icon);

    var text = document.createTextNode(item.description);
    if (item.action === 'PIVOT'){
      // Indent and print results_id
      var a = document.createElement('a');
      $(a).text(item.results_id);
      console.log('pivot item', item);
      a.title  = self.transcript[ self.get_id(item.results_id) ].description;
      $(a).click(self.load_item.bind([self, item]));
      $(a).addClass('pivot_reference');
      var span = document.createElement('span');
      span.appendChild(a);
      span.appendChild(document.createTextNode('\t'));
      span.appendChild(document.createTextNode(item.description));
      cell.appendChild(span);
    }
    // var text = document.createTextNode(tabs + item.action + ' ' + item.scope);
    // Create link if this is a search
    else if (item.action === 'SEARCH'){
      var a = document.createElement('a');
      a.appendChild(text)
      $(a).click(self.load_item.bind([self, item]));
      var span = document.createElement('i');
      $(span).addClass('fa fa-close fa-fw');
      $(span).click(function(e){
        var item = this; // use bound scope for item
        console.log(item);
        console.log('hiding transcript id ' + item.id);
        $.post('transcript', {action:'HIDE', id:item.id}, function(e){
          var item = this;
          item.visible = 0;
          self.render();
          self.callbacks.notify('Transcript ' + item.id + ' hidden');
        }.bind(item)).fail(function(e){
          console.error(e);
          var errstr = 'Unable to set visibility';
          console.error(errstr);
          self.callbacks.error(errstr);
        });

      }.bind(item));
      // console.log('selected: ' + self.selected + ', item ref: ' + item.results_id);
      // if (self.selected === item.results_id)
      //   $(span).addClass('fa fa-check-square-o fa-fw');
      // else
      //   $(span).addClass('fa fa-square-o fa-fw');
      cell.appendChild(span);
      cell.appendChild(a);
    }
    else {
      cell.appendChild(text);
    }
    
    //cell.appendChild(text);  
    
    row.appendChild(cell);
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  $('#transcript_container').append(table);
};