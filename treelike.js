'use strict';

var ts = new Date();
function console_log(msg) {
    var nd = new Date();
    console.log(msg + ': ' + (nd - ts))
    ts = nd;
}
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
    this.compareSettings = {};
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
    this.dims = _(this.dims).without(dimToRemove);
    if (opts && opts.fromList) {
        this.allDims = _(this.allDims).without(dimToRemove);
    }
    this.refreshRoot(opts)
};
treelike.DataSet.prototype.refreshRoot = function(opts) {
    var that = this;
    delete this.rootVal.kids;
    delete this.rootVal.children;
    delete this.rootVal._children;
    delete this.rootVal.childLinks;
    opts = opts || {};
    _.each(this.dims
            .slice(this.compareSettings.dim ? 1 : 0), 
            function(d) {
                opts.excludeValues = treelike.browserUI.filteredValues(d);
                that.rootVal.extendGroupBy(d, opts);
            });
};
treelike.DataSet.prototype.dimPos = function(dim) {
    var that = this;
    if (dim === 'Root') {
        return 0;
    }
    if (! _(this.dimWidths).has(dim)) {
        throw new Error("no width set for " + dim);
    }
    var idx = _(this.dims).indexOf(dim);
    if (idx === -1) {
        throw new Error("asked for pos of unused dim");
    }
    var pos = 0;
    if (idx < this.dims.length - 1) {
        // last level sticks out, doesn't need space
        idx++;
    } else {
        pos = 70;
    }
    pos = _(this.dims.slice(0, idx)).reduce(function(memo, d) {
        return memo + that.dimWidths[d];
    }, pos);
    return pos;
}
treelike.browserUI = (function() {
    var bu = {}, dataSet, navBar, valueFilters = {};
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
            /*
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
                        / *
                        $(that.$element[0].parentElement).append(
                            '<button>Show only ' + vals.length + ' ' + dim + ' values' + '</button>'
                            );
                         * /
                    });
                    bu.update();
                    return this.query 
                },
            });
            */
        })();
    };
    bu.update = function() {
        updateDims('div.dim-list>ul.displayed-dims', dataSet.dims);
        updateDims('div.dim-list>ul.unused-dims', _.difference(dataSet.allDims, dataSet.dims));
    };
    function sparkBars(node, arr, width, height, color, dim, val) {
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
            .attr('width', barWidth)
        return svg;
    }
    function updateDim(liNode, datum) {
        var li = d3.select(liNode);
        li.append('div')
            .attr('class', 'delete-icon')
            .on('click', dimClick)
            // X to trash the whole dimension control:
            .append('i').attr('class', ' icon-remove')
            .on('mouseover', function(d) {
                treelike.tooltip.showTooltip('discard ' + d + ' dimension')
            })
            .on('mouseout', function(d) { treelike.tooltip.hideTooltip(); });
        ;
        li.append('span').text(function(d) { return d });
        var vals = dataSet.dimGroups[datum];
        li.append('span')
            .style('font-size', '70%')
            .style('font-weight', 'normal')
            .text(' ' + vals.length + ' val' + (vals.length === 1 ? '' : 's') + ' ');
        li.append('div').attr('class','buttons');
        var vals = dataSet.dimGroups[datum];
        var chart = li.append('div');
        chart.text(vals.length + ' val' + 
            (vals.length === 1 ? '' : 's') + ' ');
        sparkBars( chart, 
                _.chain(vals).pluck('records').pluck('length').value(),
                100, 20, '#777', datum, vals)
            .on('mouseover', function(d) {
                var tip = _(vals).map(function(d) {
                                return d + ' (' + d.records.length + ' recs)'
                            }).join('<br/>\n'); 
                treelike.tooltip.showTooltip(
                    tip, {'font-size': '11px', 'font-weight':'normal'});
            })
            .on('mouseout', function(d) {
                treelike.tooltip.hideTooltip();
            });
    }
    function makeButtons(node, datum) {
            var ul = d3.select(node)
                        .selectAll('ul.dim-list div.buttons');
            ul.selectAll('button').remove();
            if (dataSet.dims.indexOf(datum) === -1) {
                ul.append('button').attr('class','btn btn-mini')
                    //.text('Show')
                    .on('click', function(dim) {
                        dataSet.dims.push(dim);
                        var opts = {excludeValues: filteredValues(dim)};
                        dataSet.rootVal.extendGroupBy(dim, opts);
                        treelike.collapsibleTree.root = dataSet.rootVal;
                        treelike.collapsibleTree.update(treelike.collapsibleTree.root, true);
                        bu.update();
                    })
                    .append('i').attr('class', 'icon-ok-circle')
                    .on('mouseover', function(d) {
                        treelike.tooltip.showTooltip('add ' + d + ' to tree')
                    })
                    .on('mouseout', function(d) { treelike.tooltip.hideTooltip(); });
                    ;
            } else {
                ul.append('button').attr('class','btn btn-mini') // Remove
                    .on('click', function(dimToRemove) {
                        dataSet.spliceDim(dimToRemove);
                        treelike.collapsibleTree.root = dataSet.rootVal;
                        treelike.collapsibleTree.update(treelike.collapsibleTree.root, true);
                        bu.update();
                    })
                    .append('i').attr('class', 'icon-remove-circle')
                    .on('mouseover', function(d) {
                        treelike.tooltip.showTooltip('remove ' + d + ' from tree')
                    })
                    .on('mouseout', function(d) { treelike.tooltip.hideTooltip(); });
                datum !== dataSet.dims[0] && ul.append('button').attr('class','btn btn-mini')
                    .on('click', function(d) {
                        treelike.collapsibleTree.toggleMerge(d+'');
                        bu.update();
                    })
                    .append('i').attr('class', ' icon-random')
                    .on('mouseover', function(d) {
                        treelike.tooltip.showTooltip('toggle merging of ' + d + ' values')
                    })
                    .on('mouseout', function(d) { treelike.tooltip.hideTooltip(); });
                ul.append('button').attr('class','btn btn-mini')
                    .on('click', function(dim) { makeWider(dim); })
                    .append('i').attr('class', ' icon-resize-full')
                    .on('mouseover', function(d) {
                        treelike.tooltip.showTooltip('move ' + d + ' right')
                    })
                    .on('mouseout', function(d) { treelike.tooltip.hideTooltip(); });
                ul.append('button').attr('class','btn btn-mini')
                    .on('click', function(dim) { makeNarrower(dim); })
                    .append('i').attr('class', ' icon-resize-small')
                    .on('mouseover', function(d) {
                        treelike.tooltip.showTooltip('move ' + d + ' left')
                    })
                    .on('mouseout', function(d) { treelike.tooltip.hideTooltip(); });
            }
            ul.append('button').attr('class','btn btn-mini')
                .on('click', compare2)
                .html('<i class="icon-question-sign"></i><i class="icon-resize-horizontal"></i><i class="icon-question-sign"/></i>')
                .on('mouseover', function(d) {
                    treelike.tooltip.showTooltip('compare 2 ' + d + ' values')
                })
                .on('mouseout', function(d) { treelike.tooltip.hideTooltip(); });
            ul.append('button').attr('class','btn btn-mini') // show filters
                .on('click', function(dim) {
                    filterDimension(dim);
                })
                .append('i').attr('class', 'icon-filter')
                .on('mouseover', function(d) {
                    treelike.tooltip.showTooltip('filter ' + d + ' values')
                })
                .on('mouseout', function(d) { treelike.tooltip.hideTooltip(); });
            ul.filter(function(d) {
                    var vals = dataSet.dimGroups[d];
                    return vals.isNumeric;
                })
                .append('button')
                .attr('class','btn btn-mini') // show filters
                .on('click', function(d) {
                    bu.showStats(dataSet, d, this.parentElement.parentElement);
                })
                .append('i').attr('class', 'icon-info-sign')
                .on('mouseover', function(d) {
                    treelike.tooltip.showTooltip('show stats')
                })
                .on('mouseout', function(d) { treelike.tooltip.hideTooltip(); });
            ul.each(function(d) {
                if (filteredValues(d).length) {
                    d3.select(this).append('button').attr('class','btn btn-mini')
                        .text('Unhide values')
                        .on('click', function(d) {
                            delete valueFilters[d];
                            bu.update();
                        })
                }
            });
    }
    function drawBars(chart, bins, w, h, x, y, bin_number) {
        chart.selectAll("g").remove();
        var bars = chart.selectAll("g.bar")
                        .data(bins, function(arr) { return arr[0] });
        bars.enter().append("g")
                .attr("class", "bar")
            .append("rect")
                .attr("fill", "steelblue")
                .attr("transform", function(d, i) {
                    return "translate(" + x(d.x) + "," + (h - y(d.y)) + ")";
                })
                .attr("width", function(d) { return w / bin_number  })
                .attr("height", function(d) { return y(d.y); });
        var xAxis = d3.svg.axis()
            .scale(x)
            //.tickValues(x.domain())
            .ticks(4)
            .orient("bottom");
        chart.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + h + ")")
            .call(xAxis);
        //chart.node().parentElement
    }
    bu.showStats = function(dataForRecords, statsDim, container) {
        var w = 100, h = 20, chart, statsUL, data, statsDiv, binsIncr, binsDecr;
        dataSet.statsDims = dataSet.statsDims || [];
        if (dataSet.statsDims.indexOf(statsDim) === -1) {
            dataSet.statsDims.push(statsDim);

            statsDiv = d3.select(container)
                        .append('div')
                            .attr('class', 'stats')
                            .attr('dim', statsDim);
            statsDiv.append('span').attr('class','bin-number');
            binsIncr = statsDiv.append('button')
                        .attr('class','btn btn-mini pull-right')
                        .on('click', function(d) { binChange(d, 'plus') })
                        .append('i').attr('class', 'icon-plus-sign');
            binsDecr = statsDiv.append('button')
                        .attr('class','btn btn-mini pull-right')
                        .on('click', function(d) { binChange(d, 'minus') })
                        .append('i').attr('class', 'icon-minus-sign');
            chart = statsDiv.append('svg')
                    .attr('class', 'stats-hist')
                    .attr('width',w + 30)
                    .attr('height',h + 20)
                    .append('g')
                        .attr('transform', 'translate(15,0)');
                    ;
            statsUL = statsDiv.append('ul')
                        .attr('class','stats')
                        .attr('dim', statsDim);
            data = _.pluck(dataForRecords.data,statsDim);
        } else {
            statsDiv = d3.selectAll('div.stats[dim="' + statsDim + '"]');
            chart = statsDiv.select('svg.stats-hist');
            statsUL = statsDiv.select('ul.stats');
            //binsIncr = statsDiv.select('span-bins-incr');
            data = _.pluck(dataForRecords.records,statsDim);
        }
        var domain = d3.extent(data);
        var spread = domain[1] - domain[0];
        domain[0] = Math.round(domain[0] - spread / 10);
        domain[1] = Math.round(domain[1] + spread / 10);
        // algorithm from
        // http://stackoverflow.com/questions/6876358/how-to-keep-a-dynamical-histogram/6883617#6883617
        var bin_number = 3.5 * Math.sqrt(Math.sqrt(science.stats.variance(data)))
                            * Math.pow(data.length, -1/3);
        bin_number = (bin_number < 11 && dataSet.dimGroups[statsDim].length < 20) 
            ? dataSet.dimGroups[statsDim].length : bin_number;
        bin_number = Math.round(bin_number);
        var bins = d3.layout.histogram().frequency(true)
                .bins(bin_number)(data),
                //.bins(d3.range(domain[0], domain[1], spread / 8))(data),
            x = d3.scale.linear().domain(domain).range([0, w]),
            max = d3.max(bins, function(d) { return d.length; }),
            y = d3.scale.linear().domain([0, max]).range([0, h]);
        statsDiv.select('span.bin-number')
            .text(bin_number + ' bins ');

        function binChange(d, direction) {
            bin_number = bin_number + ((direction==='plus') ? 1 : -1);
            var bins = d3.layout.histogram().frequency(true)
                    .bins(bin_number)(data),
                    //.bins(d3.range(domain[0], domain[1], spread / 8))(data),
                x = d3.scale.linear().domain(domain).range([0, w]),
                max = d3.max(bins, function(d) { return d.length; }),
                y = d3.scale.linear().domain([0, max]).range([0, h]);
            statsDiv.select('span.bin-number')
                .text(bin_number + ' bins ');
            drawBars(chart, bins, w, h, x, y, bin_number);
        };
        /*
        var kde = science.stats.kde().sample(data);
        var bw = science.stats.bandwidth.nrd0(data);
        kde.bandwidth(.00001);
        var line = d3.svg.line()
                    .x(function(d) { return x(d[0]); })
                    .y(function(d) { return h - y(d[1]); });
        */
        drawBars(chart, bins, w, h, x, y, bin_number);


        /*
        chart.selectAll("path")
            .data([science.stats.bandwidth.nrd0])
                .enter().append("path")
                    .style('fill','none')
                    .style('stroke','black')
                    .style('stroke-width','1.5px')
                .attr("d", function(h) {
                    return line( 
                        kde(d3.range(low, high, (high-low)/10)))
                });
        */
        var lis = statsUL.selectAll('li')
            .data( [
                    ['count', data.length],
                    ['min', d3.min(data)],
                    ['max', d3.max(data)],
                    ['mean', Math.round(100*d3.mean(data))/100],
                    ['median', Math.round(100*d3.median(data))/100]
                ]);
        lis.exit().remove();
        lis.enter().append('li');
        lis.html(function(d) {
            return d[0] + ': ' + d[1];
        });
    }
    bu.updateStats = function(nodeData) {
        _(dataSet.statsDims).each(function(statDimData) {
            bu.showStats(nodeData, statDimData);
        });
    }
    function updateDims(selector, data) {
        var maxValueCount = _.chain(dataSet.dimGroups)
            .values().pluck('length').max().value();
        var lis = d3.select(selector).selectAll('li')
                    .data(data, _.identity);
        lis.exit().remove();
        lis.enter().append('li')
            .attr('dim', function(d) { return d })
            .classed('displayed-dim', function(d) {
                return dataSet.dims.indexOf(d) > -1;
            })
            .each(function(d) {
                updateDim(this, d);
                makeButtons(this, d);
            });
    };
    function dimClick(d) {
        d3.select(this.parentElement).remove();
        if (_(dataSet.dims).contains(d)) {
            dataSet.spliceDim(d, {fromList:true});
            treelike.collapsibleTree.root = dataSet.rootVal;
            treelike.collapsibleTree.update(treelike.collapsibleTree.root, true);
            bu.update();
        } else {
            dataSet.spliceDim(d, {fromList:true});
        }
    }
    function filterDimension(dim) {
        var footer = d3.select('div.gp-right div.gp-footer');
        footer.html('');
        footer.classed('filter-list', true);
        var controls = footer.append('div').attr('class','controls row-fluid');
        controls.append('button').attr('class','btn btn-mini pull-right') // Remove
                    .on('click', function(dimToRemove) {
                        footer.selectAll('*').remove();
                    })
                    .append('i').attr('class', 'icon-remove')
        controls.append('button')
            .attr('class', 'pull-right')
            .text('sort')
            .on('click', function() {
                var labels = footer.select('ul').selectAll('li.label');
                var first = labels[0][0];
                if (typeof first === "undefined") {
                    return;
                }
                if (typeof first.__data__.origPos === "undefined") {
                    d3.select(this).text('original order')
                    labels.each(function(d, i) {
                        d.origPos = i;
                    });
                    labels.sort(function(a,b) {
                        return d3.ascending(a.toString(), b.toString())
                    })
                } else {
                    d3.select(this).text('sort')
                    labels.sort(function(a,b) {
                        return a.origPos - b.origPos;
                    })
                    labels.each(function(d) {
                        delete d.origPos;
                    })
                }
            })
        var form = controls.append('div').attr('class','search-box')
            .append('form');
        var search = form.append('input').attr('type','text').attr('size', '30');
        form.append('input').attr('type','submit').attr('value', 'Filter')
            .attr('onclick', 'return false');
        $(search.node()).typeahead({
                source: dataSet.dimGroups[dim].rawValues(),
                items: 100,
                minLength: 2,
                updater: function(item) { 
                    valueFilters[dim] = {};  // purging all filtered values!!!!
                    var that = this;
                    _.chain(this.options.source)
                        .filter(function(d) { return that.matcher(d) })
                        .each(function(d) {
                            toggleValue(dim, d);
                        });
                    if (_(dataSet.dims).contains(dim)) {
                        dataSet.refreshRoot({excludeValues: filteredValues(dim), keepDim: true});
                        treelike.collapsibleTree.root = dataSet.rootVal;
                        treelike.collapsibleTree.update(treelike.collapsibleTree.root, true);
                    }
                    bu.update();
                    filterDimension(dim);
                }
            });
        footer.append('ul').attr('class','filter-list')
            .selectAll('li').data(dataSet.dimGroups[dim])
                .enter()
                .append('li')
                    .attr('class', 'label')
                    .text(function(d) { return d })
                .on('click', labelClick)
                .on('mouseover', labelMouseover)
                .on('mouseout', function(d) {
                    treelike.tooltip.hideTooltip();
                })
                .classed('label-filtered', function(val) {
                    var dim = val.dim;
                    return (valueFilters[dim] && valueFilters[dim][val]);
                })
        if (dataSet.compareSettings.dim) {
            var buttons = footer.select('ul.filter-list').selectAll('li.label')
            buttons
                .classed('from', function(val) { 
                    return val === dataSet.compareSettings.from })
                .classed('to', function(val) { 
                    return val === dataSet.compareSettings.to })
                .on('click',labelClick)
                .on('mouseover',labelMouseover)
        }
    }
    function makeWider(dim) {
        dataSet.dimWidths[dim] += 50;
        treelike.collapsibleTree.update(treelike.collapsibleTree.root, true);
    }
    function makeNarrower(dim) {
        dataSet.dimWidths[dim] -= 50;
        treelike.collapsibleTree.update(treelike.collapsibleTree.root, true);
    }
    function labelClick(val, i) {
        var dim = val.dim;
        if (dataSet.compareSettings.dim && dataSet.compareSettings.dim === dim) {
            var dim = val.dim;
            var change = compareRequest(val, i, this);
            dataSet.compareSettings[change + 'Idx'] = i;
            compare2(dim, change, val);
            filterDimension(dim);
        } else {
            toggleValue(dim, val);
            if (_(dataSet.dims).contains(dim)) {
                dataSet.refreshRoot({excludeValues: filteredValues(dim), keepDim: true});
                treelike.collapsibleTree.root = dataSet.rootVal;
                treelike.collapsibleTree.update(treelike.collapsibleTree.root, true);
            }
            bu.update();
            filterDimension(dim);
        }
    }
    function labelMouseover(val, i) {
        var dim = val.dim;
        var tt, filt;
        if (dataSet.compareSettings.dim && dataSet.compareSettings.dim === dim) {
            var change = compareRequest(val, i, this);
            if (change === 'from') {
                tt = 'Compare ' + val + ' and ' + dataSet.compareSettings.to;
            } else if (change === 'to') {
                tt = 'Compare ' + dataSet.compareSettings.from + ' and ' + val;
            } else {
                return;
            }
        } else {
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
        }
        treelike.tooltip.showTooltip(tt);
    }
    function compareRequest(val, i, node) {
        if (i < dataSet.compareSettings.fromIdx) {
            return 'from';
        } else if (i > dataSet.compareSettings.toIdx) {
            return 'to';
        } else if (i === dataSet.compareSettings.fromIdx) {
        } else if (i === dataSet.compareSettings.toIdx) {
        } else {
            var jqTarget = $(node);
            var xPct = d3.event.offsetX / node.clientWidth;
            var which = (xPct <= 0.5) ? 'from' : 'to';
            return which;
        }
    }
    /*
    function compareLabelClick(val, i) {
        var dim = val.dim;
        var change = compareRequest(val, i, this);
        dataSet.compareSettings[change + 'Idx'] = i;
        compare2(dim, change, val);
        filterDimension(dim);
    }
    */
    function compare2(d, change, val) {
        dataSet.dims = [d];
        if (change) {
            toggleValue(d, dataSet.compareSettings[change]);
            dataSet.compareSettings[change] = val;
            toggleValue(d, val);
        } else {
            dataSet.compareSettings.dim = d;
            var ufv = unfilteredValues(d);
            dataSet.compareSettings.from = ufv[0];
            dataSet.compareSettings.fromIdx = 0;
            dataSet.compareSettings.to = _(ufv).last();
            dataSet.compareSettings.toIdx = _.indexOf(dataSet.dimGroups[d], dataSet.compareSettings.to);
            toggleValue(d, dataSet.compareSettings.from);
            toggleValue(d, dataSet.compareSettings.to);
        }
        var from = enlightenedData.group(dataSet.data, d)[dataSet.compareSettings.fromIdx];
        var to = enlightenedData.group(dataSet.data, d)[dataSet.compareSettings.toIdx];
        dataSet.rootVal = enlightenedData.compareValue(from, to);
        treelike.collapsibleTree.root = dataSet.rootVal;
        treelike.collapsibleTree.update(treelike.collapsibleTree.root, true);
        bu.update();
    }
    /*
    function compareLabelMouseover(val, i) {
        var dim = val.dim;
        var tt, filt;
        if (dataSet.compareSettings.dim !== dim) {
            throw new Error("dataSet.compareSettings messed up");
        }
        var change = compareRequest(val, i, this);
        if (change === 'from') {
            tt = 'Compare ' + val + ' and ' + dataSet.compareSettings.to;
        } else if (change === 'to') {
            tt = 'Compare ' + dataSet.compareSettings.from + ' and ' + val;
        } else {
            return;
        }
        treelike.tooltip.showTooltip(tt);
    }
    */
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
        viz = d3.select('body');
        tooltip = viz.append("div")
            .style("display", "none")
            .style("max-width", "500px")
            //.style("background-color", "#DD8")
            .style("background-color", "rgba(242, 242, 180, .8)")
            .style("font-weight", "bold")
            .style("padding", "5px")
            .style("position", "absolute");
        initialized = true;
    }
    tt.showTooltip = function(html, styles) {
        if (!initialized) initialize();
        var m = d3.mouse(d3.select('body').node());
        tooltip
            .style("display", null)
            .style("left", m[0] + 30 + "px")
            .style("top", m[1] - 30 + "px")
            .html(html);
        if (typeof styles === "object") {
            for (var s in styles) {
                tooltip.style(s, styles[s]);
            }
        }
    }
    tt.hideTooltip = function() {
        tooltip && tooltip.style("display", "none");
    }
    return tt;
}(d3));
treelike.collapsibleTree = (function($, d3) {
    var ct = new function() {}, dataSet, valsSeen;
    ct.mergedDims = {};
    var m = [20, 20, 20, 20],
        w = $(window).width() - m[1] - m[3],
        h = 600 - m[0] - m[2],
        idCtr = 0,
        tree, diagonal, vis, nodes, node, link;
    ct.init = function(o, targetSelector) {
        w = $(targetSelector).width() - m[1] - m[3];
        h = $(targetSelector).height() - m[0] - m[2];
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
    };
    ct.update = function(source, drawFromScratch) {
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

        if (drawFromScratch) {
            vis.selectAll("g.node").remove();
        }
        // Update the nodes…
        node = vis.selectAll("g.node")
            .data(nodes, function(d) { return d.id || (d.id = ++idCtr); });

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
                //console_log(d + 'highlight ');
                treelike.browserUI.updateStats(d);
                highlightRelated(this, d, true);
                //legendReport(this, d); // BARHIGHLIGHT
            })
            .on("mouseout", function(d) { 
                highlightRelated(this, d, false);
                /* BARHIGLIGHT
                $('rect.bar').attr('fill','#777')
                */
            })

        var radius = 8;
        nodeEnter.append("svg:circle")
            //.attr("r", 1e-6)      FIX WHEN DONE WITH PIE STUFF
            .attr("r", radius)
            //.style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; })
            ;


        nodeEnter.append("svg:text")
            .attr("x", function(d) { 
                return d.children || d._children ? -10 : 10; })
            .attr("dy", ".35em")
            .attr("text-anchor", function(d) { 
                return d.children || d._children ? "end" : "start"; })
            .text(function(d) { return d + ' (' + d.records.length + ')'; })
            .style("fill-opacity", 1e-6);

        nodeEnter.filter(function(d) { return !(d.children || d._children) })
            .append("svg:rect")
                .attr("x", function(d) { 
                    return d.children || d._children ? -10 : 10; })
                .attr("y", "-.35em")
                .attr('height', '.6em')
                .attr('width', function(d) { 
                    return 2 * dataSet.dimWidths[d.dim] * d.records.length / enlightenedData
                        .aggregate(_(d.parentList).pluck('records'), 'length').max
                })
                .style('opacity', 0.10)
                .attr('fill', 'blue')

        // Transition nodes to their new position.
        var nodeUpdate = node
            //.transition().duration(duration)      FIX WHEN DONE WITH PIE STUFF
            .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

        nodeUpdate.select("circle")
            //.attr("r", 4.5)
            //.attr("r", function(d) { return .004 * d.records.length; })
            //.style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; })

        var arc = d3.svg.arc()
            .startAngle(0)
            .endAngle(function(d) { 
                return  2 * Math.PI * d.records.length / 
                    dataSet.data.length })
            .innerRadius(function(d) { return 0; })
            .outerRadius(function(d) { return radius });

        nodeUpdate.append('path').attr('d', arc)
            ;

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
    /* restore by uncommenting BARHIGHLIGHT
    function legendReport(node, d) {
        var dimVals;
        var cs = dataSet.compareSettings;
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
        console_log(d + 'bar color ');
        _(dimVals).each(function(list) {
            _(list).each(function(val) {
                d3.select( dataSet.dimGroups[list.dim]
                    .lookup(val.toString()).legendBar)
                    .attr('fill','blue')
            });
        });
        console_log(d + 'done highlighting ');
        return;
        var footer = d3.select('div.gp-right div.gp-footer');
        footer.html('');
        footer.classed('filter-list', true);
        var dl = footer.selectAll('dl').data([d]);
        dl.exit().remove();
        dl.enter().append('dl').attr('class', 'dl-horizontal');
        var facts = {};
        facts['dim path'] = d.dimPath();
        facts['val path'] = d.namePath();
        var maxVals = _.chain(dimVals).values()
                            .map(function(d){return d.length})
                            .max().value();
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
    */
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
