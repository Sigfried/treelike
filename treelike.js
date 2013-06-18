'use strict';

var treelike = (function($) {
    var treelike = {};
    return treelike;
}(jQuery));
treelike.DataSet = function(stuff) {
    _.extend(this, stuff);
};
treelike.DataSet.prototype.dataPrep = function(data) {
    var that = this;
    this.dims = [];
    this.data = data;
    this.allDims = _(data[0]).keys();
    this.allDims = _(this.allDims).map(function(d) {
        if (d.match(/[^a-zA-Z_\-0-9]/)) {
            var cleanId = d.replace(/[^a-zA-Z_\-0-9]/g, '');
            _(that.data).each(function(row) {
                row[cleanId] = row[d];
                delete row[d];
            });
            return cleanId;
        }
        return d;
    });
    //this.dimGroups = _.chain(this.allDims).map(function(d) {
    //    return [d, _.chain(that.data).countBy(d).keys().value()];
    this.dimGroups = _.chain(this.allDims).map(function(d) {
        return [d, enlightenedData.group(that.data, d)];
    }).object().value();
    this.defaultWidths = _.chain(this.allDims).map(function(dim) {
        return [dim, Math.max(25,enlightenedData.aggregate(
                _(that.dimGroups[dim]).pluck('length')).avg * 15)]
    }).object().value();
    this.defaultWidths.Root = 80;
    this.dimWidths = _.clone(this.defaultWidths);
};
treelike.DataSet.prototype.emptyRoot = function() {
    return enlightenedData.group(
            this.data, 
            function(){ return 'All' }, 
            {dimName:'Root'}
        )[0];
};
treelike.DataSet.prototype.spliceDim = function(dimToRemove, opts) {
    // we want to delete children of the dim before this one
    var that = this;
    var replaceAt = this.dims.indexOf(dimToRemove);
    var rootVal = this.rootVal;
    var parentDimNodes;
    if (rootVal.dim === this.dims[0]) {
        if (rootVal.dim === dimToRemove) {
            //rootVal.leafNodes is kind of broken, this is a kludge
            this.dims.length = 0;
            this.rootVal = emptyRoot();
            treelike.browserUI.compareSettingsReset();
            return;
        }
        // root is comparison, first dim in this.dims
        parentDimNodes = rootVal.leafNodes(replaceAt - 1);
    } else {
        // root is fake Root node, not included in dims
        parentDimNodes = rootVal.leafNodes(replaceAt);
    }
    _.each(parentDimNodes, function(d) {
        delete d.kids;
        delete d.children;
        delete d._children;
        delete d.childLinks;
    });
    var addBackDims = this.dims.slice(replaceAt+((opts&&opts.keepDim)?0:1));
    this.dims.splice(replaceAt);
    opts = opts || {};
    _.each(addBackDims, function(d) {
        that.dims.push(d)
        opts.excludeValues = treelike.browserUI.filteredValues(d);
        rootVal.extendGroupBy(d, opts);
    });
};
treelike.DataSet.prototype.dimPos = function(dim) {
    var that = this;
    if (dim === 'Root') {
        return 0;
    }
    var idx = _(this.dims).indexOf(dim);
    if (idx === -1) {
        throw new Error("asked for pos of unused dim");
    }
    if (! _(this.dimWidths).has(dim)) {
        throw new Error("no width set for " + dim);
    }
    var pos = this.dimWidths['Root'];  // shouldn't always include Root!!
    pos = _(this.dims.slice(0, idx)).reduce(function(memo, d) {
        return memo + that.dimWidths[d];
    }, pos);
    return pos;
}
treelike.browserUI = (function() {
    var bu = {}, dataSet, navBar, valueFilters = {}, 
        compareSettings = {};
    bu.init = function(o) {
        dataSet = o;
        dataSet.rootVal = dataSet.emptyRoot();
        return _.once(function() {
            bu.update();
            var dimVals = _.chain(dataSet.dimGroups).pairs()
                        .map(function(p) { 
                            return _(p[1]).map(function(d){return p[0]+':'+d})
                        })
                        .flatten(true).value();
            $('.search-box input[type=text]').typeahead({
                source: dimVals,
                items: 100,
                minLength: 2,
                updater: function(item) { 
                    valueFilters = {};  // purging all filtered values!!!!
                    var that = this;
                    console.log(item); 
                    console.log(this); 
                    var matchedDimVals = {};
                    _.chain(this.options.source)
                        .filter(function(d) { return that.matcher(d) })
                        .each(function(d) {
                            var s = d.split(/:/);
                            matchedDimVals[s[0]] = matchedDimVals[s[0]] || {};
                            matchedDimVals[s[0]][s[1]] = true;
                        });
                    _.chain(matchedDimVals).pairs().each(function(p) {
                        var dim = p[0];
                        var vals = _(p[1]).keys();
                        //delete valueFilters[dim];  // doesn't clear from previous match
                        _(vals).each(function(d) {
                            toggleValue(dim, d);
                        });
                        /*
                        $(that.$element[0].parentElement).append(
                            '<button>Show only ' + vals.length + ' ' + dim + ' values' + '</button>'
                            );
                         */
                    });
                    bu.update();
                    return this.query 
                },
            });
        })();
    };
    bu.update = function() {
        updateDims('div.unused-dims>ul', _.difference(dataSet.allDims, dataSet.dims));
        updateDims('div.displayed-dims', dataSet.dims, true);
        addButtons();
        // overriding bootstrap.js line 1820
        $(document).off('click.tab.data-api');
        $(document).on('click.tab.data-api', '[data-toggle="tab"]', function (e) {
            e.preventDefault();
            var tab = $($(this).attr('href'));
            var activate = !tab.hasClass('active');
            $('div.tab-content>div.tab-pane.active').removeClass('active');
            $('ul.nav.nav-tabs>li.active').removeClass('active');
            if (activate) {
                $(this).tab('show')
            }
        });
    };
    function sparkBars(node, arr, width, height, color) {
        var x = d3.scale.linear()
                .domain([0, arr.length])
                .range([0, width]);
        var y = d3.scale.linear()
                .domain([0, d3.max(arr)])
                .range([0, height]);
        var barWidth = width / arr.length;
        var svg = node.append('svg')
            .attr('width', width)
            .attr('height', height);
        svg.append('rect')
            .attr('fill', '#DDA')
            .attr('width', width)
            .attr('height', height);

        var bars = svg.selectAll('rect.bar')
                        .data(arr);
        bars.enter().append('rect')
            .attr('class', 'bar')
            .attr('fill', color)
            .attr('x', function(d,i) { return x(i) })
            .attr('y', function(d) { return height - y(d) })
            .attr('height', function(d) { return y(d) })
            .attr('width', barWidth);
    }
    function updateDims(selector, data, align) {
        var maxValueCount = _.chain(dataSet.dimGroups)
            .values().pluck('length').max().value();
        var lis = d3.select(selector).selectAll('li')
                    .data(data);
        lis.exit().remove();
        lis.enter().append('li')
            .attr('dim', function(d) { return d })
            .append('span').text(function(d) {
                var vals = dataSet.dimGroups[d];
                return vals.length + ' ' + d;
            });
        lis.append('span')
            .each(function(d) {
                var vals = dataSet.dimGroups[d];
                var span = d3.select(this);
                sparkBars( span, 
                    _.chain(vals).pluck('records').pluck('length').value(),
                    100, 20, '#777');
            });
        return;
        var templ = _.template(
            '<li dim="<%=data.dim%>">' +
            '<%= data.vals %> <%= data.dim %>' +
            '<%= data.sparkbars %>' +
            '</li>'
            //'<div class="progress">' +
            //'<div class="bar" style="width:<%= data.pct %>%">' +
            //'</div></div></li>'
            , null, {variable:'data'});
        var lis = _(dataSet.allDims).map(function(d,i) {
                    return templ({
                        dim:d, 
                        i: i,
                        pct:Math.round(100*dataSet.dimGroups[d].length/maxValueCount),
                        vals: dataSet.dimGroups[d].length,
                        sparkbars: sparkBars(
                            _(dataSet.dimGroups[d]).pluck('length'),
                            100, 20, '#777').outerHTML,
                    });
                });
        $(selector).html(lis.join('\n'));
        $(selector).find('li').on('click', labelClick);
        return;

            var dimControls = d3.select(selector).select('ul.nav.nav-tabs')
                                .selectAll('li')
                                .data(data, _.identity);
            dimControls.exit().remove();
            dimControls.enter().append('li').each(function(d, i) {
                var distinctVals = dataSet.dimGroups[d];
                var li = d3.select(this);
                var a = li.append('a')
                    .attr('href', '#' + d)
                    .attr('class', 'dropdown-toggle')
                    .attr('data-toggle','tab')
                    .append('label').classed('val-name', true)
                        .text(d);
                a.append('label').classed('val-count', true)
                    .style('font-size', '70%')
                    .text(distinctVals.length + ' vals');
                a.append('label').classed('vals-shown', true)
                    .style('font-size', '70%')
                if (align) {
                    if (i === 0) {
                        li.style('padding-left', (80 + dataSet.dimWidths['Root']) + 'px');
                    }
                    li.style('padding-right', (dataSet.dimWidths[d] -
                            $(li.node()).width()) + 'px');
                }
            });
            dimControls.selectAll('label.vals-shown')
                .text(function(d) {
                    var fv = filteredValues(d).length;
                    if (fv) {
                        return (dataSet.dimGroups[d].length - fv) + ' shown'
                    }
                });
            dimControls.sort(function(a,b) { return dimControlSortKey(a) - dimControlSortKey(b) })
            var dimTabs = d3.select(selector).select('div.tab-content')
                                .selectAll('div.tab-pane')
                                .data(data, _.identity);
            dimTabs.exit().remove();
            dimTabs.enter().append('div')
                    .attr('class', 'tab-pane fade')
                    .attr('id', _.identity)
                .each(function(dim, i) {
                    var tab = d3.select(this);
                    //var distinctVals = _.keys(dataSet.allData.valueLists[dim]);
                    var distinctVals = dataSet.dimGroups[dim];
                    //tab.append('span').attr('class', 'label label-info').text(distinctVals.length + ' values');
                    tab.append('div').attr('class','btn-group');
                    var labels = tab.append('ul').attr('class','inline')
                        .selectAll('li')
                            .data(distinctVals);
                    labels.enter().append('li')
                                .attr('class', 'label')
                                .text(_.identity)
                            .on('click', regularLabelClick)
                            .on('mouseover', regularLabelMouseover)
                            .on('mouseout', function(d) {
                                treelike.tooltip.hideTooltip();
                            })
                })
            dimTabs.selectAll('li.label')
                .classed('label-inverse', function(val) {
                    var dim = this.parentElement.__data__;
                    return ! (valueFilters[dim] && valueFilters[dim][val]);
                })

    };
    function addButtons() {
        var uls = d3.selectAll('div.tab-content div.btn-group');
        uls.each(function(d) {
            var ul = d3.select(this);
            ul.selectAll('button').remove();
            if (dataSet.dims.indexOf(d) === -1) {
                ul.append('button').attr('class','btn').text('Show')
                    .on('click', function(dim) {
                        dataSet.dims.push(dim);
                        var opts = {excludeValues: filteredValues(dim)};
                        dataSet.rootVal.extendGroupBy(dim, opts);
                        treelike.collapsibleTree.root = dataSet.rootVal;
                        treelike.collapsibleTree.update(treelike.collapsibleTree.root);
                        bu.update();
                    });
            } else {
                ul.append('button').attr('class','btn').text('Remove')
                .on('click', function(dimToRemove) {
                    dataSet.spliceDim(dimToRemove);
                    treelike.collapsibleTree.root = dataSet.rootVal;
                    treelike.collapsibleTree.update(treelike.collapsibleTree.root);
                    bu.update();
                });
                d !== dataSet.dims[0] && ul.append('button').attr('class','btn')
                    .text(function(d) {
                        //var parentDim = dataSet.dims[dataSet.dims.indexOf(d) - 1];
                        return treelike.collapsibleTree.mergedDims[d+''] ?
                            'Separate' : 'Merge';
                    })
                    .on('click', function(d) {
                        //var parentDim = dataSet.dims[dataSet.dims.indexOf(d) - 1];
                        //var merge = treelike.collapsibleTree.mergedDims[parentDim] = !  treelike.collapsibleTree.mergedDims[parentDim];
                        //treelike.collapsibleTree.update();
                        treelike.collapsibleTree.toggleMerge(d+'');
                        bu.update();
                    });
            }
            ul.append('button').attr('class','btn').text('Compare 2')
                .on('click', compare2)
            ul.each(function(d) {
                if (filteredValues(d).length) {
                    d3.select(this).append('button').attr('class','btn')
                        .text('Unhide values')
                        .on('click', function(d) {
                            delete valueFilters[d];
                            bu.update();
                        })
                }
            });
        });
    }
    function labelClick(evt) {
        var dim = $(evt.target).attr('dim');
        var vals = dataSet.dimGroups[dim];
        console.log(dim);
    }
    function regularLabelClick(val) {
        var dim = this.parentElement.parentElement.__data__;
        console.log('trying to toggle ' + dim + ': ' + val);
        toggleValue(dim, val);
        if (_(dataSet.dims).contains(dim)) {
            dataSet.spliceDim(dim, {excludeValues: filteredValues(dim), keepDim: true});
            treelike.collapsibleTree.root = dataSet.rootVal;
            treelike.collapsibleTree.update(treelike.collapsibleTree.root);
        }
        bu.update();
    }
    function regularLabelMouseover(val) {
        var dim = this.parentElement.parentElement.__data__;
        var tt, filt;
        if (!valueFilters[dim]) {
            tt = 'Hide others';
        } else {
            if (valueFilters[dim][val]) {
                tt = 'Show';
            } else {
                if (valueFilters[dim].pivot === val) {
                    tt = 'Hide this, show others';
                } else {
                    tt = 'Hide';
                }
            }
        }
        treelike.tooltip.showTooltip(tt);
    }
    bu.compareSettings = function() { return compareSettings };
    bu.compareSettingsReset = function() { compareSettings = {} };
    function compareRequest(val, i, node) {
        if (i < compareSettings.fromIdx) {
            return 'from';
        } else if (i > compareSettings.toIdx) {
            return 'to';
        } else if (i === compareSettings.fromIdx) {
        } else if (i === compareSettings.toIdx) {
        } else {
            var jqTarget = $(node);
            var xPct = d3.event.offsetX / node.clientWidth;
            var which = (xPct <= 0.5) ? 'from' : 'to';
            return which;
        }
    }
    function compareLabelClick(val, i) {
        var dim = this.parentElement.parentElement.__data__;
        var change = compareRequest(val, i, this);
        compareSettings[change + 'Idx'] = i;
        compare2(dim, change, val);
    }
    function compare2(d, change, val) {
        dataSet.dims = [d];
        if (change) {
            toggleValue(d, compareSettings[change]);
            compareSettings[change] = val;
            toggleValue(d, val);
        } else {
            compareSettings.dim = d;
            var ufv = unfilteredValues(d);
            compareSettings.from = ufv[0];
            compareSettings.fromIdx = 0;
            compareSettings.to = _(ufv).last();
            compareSettings.toIdx = _.indexOf(dataSet.dimGroups[d], compareSettings.to);
            toggleValue(d, compareSettings.from);
            toggleValue(d, compareSettings.to);
        }
        var from = enlightenedData.group(dataSet.data, d)[compareSettings.fromIdx];
        var to = enlightenedData.group(dataSet.data, d)[compareSettings.toIdx];
        dataSet.rootVal = enlightenedData.compareValue(from, to);
        treelike.collapsibleTree.root = dataSet.rootVal;
        treelike.collapsibleTree.update(treelike.collapsibleTree.root);
        bu.update();
        var buttons = d3.select('#' + d).selectAll('li.label')
        buttons
            .classed('from', function(val) { 
                return val === compareSettings.from })
            .classed('to', function(val) { 
                return val === compareSettings.to })
            .on('click',compareLabelClick)
            .on('mouseover',compareLabelMouseover)
    }
    /*
    tree.compareTo = function(value) {
        tree.from(root).to(value);
        var name = from + ' to ' + to;
        var val = new String(name);
        val.from = from;
        val.to = to;
        val.depth = 0;
        val.in = "both";
        val.records = [].concat(from.records,to.records);
        val.records.parentVal = val; // NOT TESTED, NOT USED, PROBABLY WRONG
        val.dim = value.dim;
        return root = val;
    };
    */
    function compareLabelMouseover(val, i) {
        var dim = this.parentElement.parentElement.__data__;
        var tt, filt;
        if (compareSettings.dim !== dim) {
            throw new Error("compareSettings messed up");
        }
        var change = compareRequest(val, i, this);
        if (change === 'from') {
            tt = 'Compare ' + val + ' and ' + compareSettings.to;
        } else if (change === 'to') {
            tt = 'Compare ' + compareSettings.from + ' and ' + val;
        } else {
            return;
        }
        treelike.tooltip.showTooltip(tt);
    }
    function dimControlSortKey(d) { 
        var idx = dataSet.dims.indexOf(d);
        return (idx > -1) ? idx : dataSet.allDims.indexOf(d) 
    }
    function filteredValues(dim) {
        return _.chain(valueFilters[dim])
                .pairs()
                .filter(function(p){return p[1]===true})
                .map(function(d){return d[0]})
                .value()
    }
    bu.filteredValues = filteredValues;
    function unfilteredValues(dim) {
        return _.difference(dataSet.dimGroups[dim], filteredValues(dim));
    }
    function toggleValue(dim, val) {
        if (!valueFilters[dim]) {
            valueFilters[dim] = {};
        }
        var filt = valueFilters[dim];
        if (filt.pivot) {
            if (filt.pivot === val) {
                if (filt[val]) {
                    delete filt[val];
                    delete filt.pivot;
                } else {
                    _(dataSet.dimGroups[dim]).each(function(v) {
                        filt[v] = (v === val) ? true : false;
                    });
                }
            } else {
                filt[val] = !filt[val];
                filt.pivot = 'individual selection';
            }
        } else {
            filt.pivot = val;
            _(dataSet.dimGroups[dim]).each(function(v) {
                filt[v] = (v === val) ? false : true;
            });
        }
        //bu.update();  leave it up to caller?
    }
    return bu;
}());
treelike.tooltip = (function(d3) {
    var $ = undefined;  // just to make sure I won't use jQuery here without intending to
    var tt = {}, initialized = false, viz, tooltip;
    function initialize() {
        viz = d3.select('#viz');
        tooltip = viz.append("div")
            .style("display", "none")
            //.style("background-color", "#DD8")
            .style("background-color", "rgba(242, 242, 180, .8)")
            .style("font-weight", "bold")
            .style("padding", "5px")
            .style("position", "absolute");
        initialized = true;
    }
    tt.showTooltip = function(html) {
        if (!initialized) initialize();
        var m = d3.mouse(viz.node());
        tooltip
            .style("display", null)
            .style("left", m[0] + 30 + "px")
            .style("top", m[1] - 30 + "px")
            .html(html);
    }
    tt.hideTooltip = function() {
        tooltip && tooltip.style("display", "none");
    }
    return tt;
}(d3));
treelike.collapsibleTree = (function($, d3) {
    var ct = new function() {}, dataSet, valsSeen;
    ct.mergedDims = {};
    var m = [20, 80, 20, 80],
        w = $(window).width() - m[1] - m[3],
        h = 600 - m[0] - m[2],
        i = 0,
        tree, diagonal, vis, nodes, node, link;
    ct.init = function(o, targetSelector) {
        w = $(targetSelector).width() - m[1] - m[3],
        dataSet = o; // the obj returned by treelike.data.load
        vis = d3.select(targetSelector).append("svg:svg")
            .attr("width", w + m[1] + m[3])
            .attr("height", h + m[0] + m[2])
        .append("svg:g")
            .attr("transform", "translate(" + m[3] + "," + m[0] + ")");
    };
    ct.recalc = function(root) {
        ct.root = root;
        tree = d3.layout.tree()
            .size([h, w])
            .children(function(d) {
                var children = _(d).has('children') ? d.children : d.kids;
                return children;
            });
        diagonal = d3.svg.diagonal()
            .projection(function(d) { return [d.y, d.x]; });
        // hide all children except first level
        //root.children.forEach(toggleAll);
        ct.update(root);
    };
    ct.update = function(source) {
        if (!tree) {
            ct.recalc(source);
        }
        source = source || ct.root;
        if (_.isUndefined(ct.root.x0)) {
            ct.root.x0 = h / 2;
            ct.root.y0 = 0;
        }
        var duration = d3.event && d3.event.altKey ? 5000 : 500;

        valsSeen = {};
        // Compute the new tree layout.
        nodes = tree.nodes(ct.root).reverse();
        fixMerge();

        // Normalize for fixed-depth.
        //nodes.forEach(function(d) { d.y = d.depth * 180; });
        nodes.forEach(function(d) { 
            d.y = dataSet.dimPos(d.dim);
        });

        // Update the nodes…
        node = vis.selectAll("g.node")
            .data(nodes, function(d) { return d.id || (d.id = ++i); });

        // Enter any new nodes at the parent's previous position.
        var nodeEnter = node.enter().append("svg:g")
            .attr("class", "node")
            .attr("dim", function(d) { return d.dim })
            .attr("val", function(d) { return d+'' })
            .attr("transform", function(d) { 
                return "translate(" + source.y0 + "," + source.x0 + ")"; })
            .each(function(d) {
                d.gNode = this;
            })
            .on("click", function(d) { 
                toggle(d); ct.update(d); })
            .on("mouseover", function(d) { 
                highlightRelated(this, d, true);
                legendReport(this, d);
            })
            .on("mouseout", function(d) { 
                highlightRelated(this, d, false);
            })
            ;

        function legendReport(node, d) {
            var l = d3.select('div.legend');
            var dl = l.selectAll('dl').data([d]);
            dl.exit().remove();
            dl.enter().append('dl').attr('class', 'dl-horizontal');
            var facts = {};
            facts['dim path'] = d.dimPath();
            facts['val path'] = d.namePath();
            var dimVals;
            var cs = treelike.browserUI.compareSettings();
            dimVals = _(dataSet.allDims).map(function(dim) {
                var g;
                if (cs.dim) {
                    g = (d.in === "both") ?
                            enlightenedData.diffGroup(d.from, d.to, dim) :
                            enlightenedData.group(d.records, dim);
                    _(g).each(function(d) { d.extendGroupBy(cs.dim) });
                } else {
                    g = enlightenedData.group(d.records, dim);
                }
                return g;
            });
            var maxVals = _.chain(dimVals).values()
                                .map(function(d){return d.length})
                                .max().value();
            /*
            var rectProportion = 5; // width:height is 5:1
            var scale = d3.scale.pow(1/2)
                            .domain([0,maxVals * rectProportion])
                            .range([10,100])
            */
            var scale = d3.scale.linear()
                            .domain([0,maxVals])
                            .range([0,100]);
            _(dimVals).each(function(list) {
                var bar;
                var width = scale(list.length);
                if (cs.dim && d.in === "both") {
                    var fromRecs = _.chain(list)
                        .map(function(d) {return d.from}).filter(_.identity)
                        .pluck('records').pluck('length').value();
                    var fromCnt = enlightenedData.aggregate(fromRecs).sum;
                    var toRecs = _.chain(list)
                        .map(function(d) {return d.to}).filter(_.identity)
                        .pluck('records').pluck('length').value();
                    var toCnt = enlightenedData.aggregate(toRecs).sum;
                    var fromProp = fromCnt / (fromCnt + toCnt);
                    bar = makeBar(width * fromProp, '#966') +
                          makeBar(width * (1 - fromProp), '#44F') +
                          ' ' + list.length 
                        /*
                        + '(' +
                        $('<span>' + (list.kids ? list.kids.length : 0) + '</span>')
                            .css('background-color', '#966')[0].outerHTML +
                        $('<span>' + (list.kids ? list.kids.length : 0) + '</span>')
                            .css('background-color', '#966')[0].outerHTML +
                        ')'
                        */
                } else {
                    var color = cs.dim ? 
                        ((d.in === 'from') ? '#966' : '#44F') : '#888';
                    bar = makeBar(width, color) + ' ' + list.length;
                }
                facts[list.dim + ' values'] = bar;
            });
            dl.html( _.chain(facts).pairs().map(function(pair) {
                        return '<dt>' + pair[0] + '</dt><dd>' + pair[1] + '</dd>';
                    }).join('\n').value());
        }
        function makeBar(width, color) {
            return $('<div></div>')
                .css('background-color', color)
                .css('display', 'inline-block')
                .width(width)
                .height('1em')[0].outerHTML;
        }
        function nodeHighlight(node) {
            if (_(node.__data__).has('mergeWith')) {
                node = node.__data__.mergeWith.gNode;
            }
            var t = d3.select(node).select('text');
            if (!_(t.node()).has('fontSizeOrig')) {
                t.node().fontSizeOrig = t.style('font-size');
            }
            t.style('font-weight','bold').style('font-size',parseInt(t.node().fontSizeOrig) * 1.5);
        }
        function nodeUnhighlight(node) {
            if (_(node.__data__).has('mergeWith')) {
                node = node.__data__.mergeWith.gNode;
            }
            var t = d3.select(node).select('text');
            if (_(t.node()).has('fontSizeOrig')) {
                t.style('font-weight','normal').style('font-size',t.node().fontSizeOrig);
            }
        }
        function highlightRelated(thisNode, d, on) {
            (on ? nodeHighlight : nodeUnhighlight)(thisNode);
            var nodesHere = [thisNode];
            if (_(d).has('mergeList')) {
                nodesHere = nodesHere.concat(_(d.mergeList).pluck('gNode'));
            }
            _(nodesHere).each(function(node) {
                _.each(node.__data__.childLinks, function(c) {
                    var s = d3.select(c);
                    s.style('stroke', d3.rgb(s.style('stroke'))[(on ? 'darker' : 'brighter')](3));
                    (on ? nodeHighlight : nodeUnhighlight)(c.__data__.target.gNode);
                });
                _.each(node.__data__.parentLinks, function(c) {
                    var s = d3.select(c);
                    s.style('stroke', d3.rgb(s.style('stroke'))[(on ? 'darker' : 'brighter')](3));
                    (on ? nodeHighlight : nodeUnhighlight)(c.__data__.source.gNode);
                });
            });
        }
        nodeEnter.append("svg:circle")
            .attr("r", 1e-6)
            .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; })
            ;

        nodeEnter.append("svg:text")
            .attr("x", function(d) { return d.children || d._children ? -10 : 10; })
            .attr("dy", ".35em")
            .attr("text-anchor", function(d) { return d.children || d._children ? "end" : "start"; })
            .text(function(d) { return d+''; })
            .style("fill-opacity", 1e-6);

        // Transition nodes to their new position.
        var nodeUpdate = node.transition()
            .duration(duration)
            .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

        nodeUpdate.select("circle")
            .attr("r", 4.5)
            .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

        nodeUpdate.select("text")
            .style("fill-opacity", 1);

        // Transition exiting nodes to the parent's new position.
        var nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
            .remove();

        nodeExit.select("circle")
            .attr("r", 1e-6);

        nodeExit.select("text")
            .style("fill-opacity", 1e-6);

        // Update the links…
        link = vis.selectAll("path.link")
            .data(tree.links(nodes), function(d) { return d.target.id; });

        // Enter any new links at the parent's previous position.
        link.enter().insert("svg:path", "g")
            .attr("class", "link")
            .classed('from-version', function(d) { 
                //console.log(d.source.path + ' --> ' + d.target.path);
                return d.target.in === "from" })
            .classed('to-version', function(d) { 
                return d.target.in === "to" })
            .attr("d", function(d) {
                // sigfried adding link ref here
                if ('childLinks' in d.source) {
                    d.source.childLinks.push(this);
                } else {
                    d.source.childLinks = [this];
                }
                if ('parentLinks' in d.target) {
                    d.target.parentLinks.push(this);
                } else {
                    d.target.parentLinks = [this];
                }

                var o = {x: source.x0, y: source.y0};
                return diagonal({source: o, target: o});
            })
            .transition()
            .duration(duration)
            .attr("d", diagonal);

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(duration)
            .attr("d", function(d) {
                var o = {x: source.x, y: source.y};
                return diagonal({source: o, target: o});
            })
            .remove();

        transition(duration);
    }
    function transition(duration, delay) {
        duration = duration || 1000;
        delay = delay || 0;
        // Transition links to their new position.
        link.transition()
            .delay(delay)
            .duration(duration)
            .attr("d", diagonal);

        var nodeUpdate = node.transition()
            .delay(delay)
            .duration(duration)
            .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

        // Stash the old positions for transition.
        nodes.forEach(function(d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }
    function fixMerge() {
        var mergedDims = _.chain(ct.mergedDims).pairs()
            .filter(function(d){return d[1]})
            .map(function(d){return d[0]}).value();
        _(mergedDims).each(function(md) {
            // toggle here so toggleMerge can toggle it back
            treelike.collapsibleTree.mergedDims[md] = !  treelike.collapsibleTree.mergedDims[md];
            ct.toggleMerge(md);
        });
    }
    ct.toggleMerge = function(dim) {
        var merge = treelike.collapsibleTree.mergedDims[dim] = !  treelike.collapsibleTree.mergedDims[dim];
        var dimNodes = _(nodes).filter(function(d){return d.dim === dim}).reverse();
        if (merge) {
            var xmin = _.chain(dimNodes).pluck('x').min().value();
            var xmax = _.chain(dimNodes).pluck('x').max().value();
            var seen = {};
            _(dimNodes).each(function(d) {
                var val = d.toString();
                if (! _(seen).has(val)) {
                    seen[val] = d;
                    d.mergeList = [];
                } else {
                    d.mergeWith = seen[val];
                    d.mergeWith.mergeList.push(d);
                }
            });
            var scale = d3.scale.linear()
                    .domain([0, _(seen).keys().length - 1])
                    .range([xmin,xmax]);
            //_(seen).each(function(d) {
                //d.x = scale(i);
            //});
            _(dimNodes).each(function(d, i) {
                if (! _(d).has('mergeWith')) {
                    //d.x = scale(i);
                } else {
                    d.xOrig = d.x;
                    d.x = d.mergeWith.x;
                }
            });
            transition(1000, 0);
            var ctr = 0;
            _(dimNodes).each(function(d, i) {
                if (! _(d).has('mergeWith')) {
                    d.xOrig = d.x;
                    d.x = scale(ctr++);
                    //console.log(i + ': ' + d + ' from ' + d.xOrig + ' to ' + d.x);
                } else {
                    d.x = d.mergeWith.x;
                    d3.select(d.gNode).select('text').transition().delay(1000).duration(1000).style('opacity',0);
                }
            });
            transition(1000, 1000);
        } else {
            _(dimNodes).each(function(d) {
                d.x = d.xOrig || d.x;
                d3.select(d.gNode).select('text').style('opacity',1);
            });
            transition();
        }
    }

    function toggleAll(d) {
        if (d.children) {
            d.children.forEach(toggleAll);
            toggle(d);
        }
    }
    // Toggle children.
    function toggle(d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
    }
    return ct;
}(jQuery, d3));
