'use strict';
var enlightenedData = (function() {
    var e = {};
    e.group = function(list, dim, opts) {
        var g = _.groupBy(list, dim);
        if (opts && opts.excludeValues) {
            _(opts.excludeValues).each(function(d) {
                delete g[d];
            });
        }
        var isNumeric = undefined;
        var groups = _.map(_.pairs(g), function(pair) {
            var s = pair[0];
            var S = new String(s);
            S.records = pair[1];
            S.dim = (opts && opts.dimName) ? opts.dimName : dim;
            S.records.parentVal = S; // NOT TESTED, NOT USED, PROBABLY WRONG
            _.extend(S.__proto__, e.valMethods.prototype);
            if (s.length && ["null", ".", "undefined"].indexOf(s.toLowerCase()) === -1) {
                if (isNumeric === undefined)
                    isNumeric = true;
                if(isNaN(Number(s))) {
                    isNumeric = false;
                }
            }
            return S;
        });
        groups.records = list; // NOT TESTED, NOT USED, PROBABLY WRONG
        groups.dim = (opts && opts.dimName) ? opts.dimName : dim;
        _.extend(groups.__proto__, e.group.prototype);
        groups.isNumeric = isNumeric;
        _(groups).each(function(g) { g.parentList = groups });
        return groups;
    }
    e.group.prototype.rawValues = function() {
        return _(this).map(function(d) { return d.toString() });
    };
    e.group.prototype.lookup = function(query) {
        if (_.isArray(query)) {
            var values = query.slice(0);
            var list = this;
            var ret;
            while(values.length) {
                ret = this.singleLookup(values.shift());
                list = ret.kids;
            }
            return ret;
        } else {
            return this.singleLookup(query);
        }
    };
    e.group.prototype.singleLookup = function(query) {
        var that = this;
        if (! ('lookupMap' in this)) {
            this.lookupMap = {};
            this.forEach(function(d) {
                that.lookupMap[d] = d;
            });
        }
        if (query in this.lookupMap)
            return this.lookupMap[query];
    };
    e.valMethods = function() {};
    e.valMethods.prototype.extendGroupBy = function(dim, opts) {
        _.each(this.leafNodes(), function(d) {
            if (d.in && d.in === "both") {
                d.kids = e.diffGroup(d.from, d.to, dim, opts);
            } else {
                d.kids = e.group(d.records, dim, opts);
                if (d.in ) {
                    _(d.kids).each(function(c) {
                        c.in = d.in;
                        c[d.in] = d[d.in];
                    });
                }
            }
            d.kids.parentVal = d; // NOT TESTED, NOT USED, PROBABLY WRONG!!!
        });
    };
    e.valMethods.prototype.leafNodes = function(level) {
        var ret = [this];
        if (level !== 0 && this.kids && (!level || this.depth < level))
            ret = _.flatten(_.map(this.kids, function(c) {
                return c.leafNodes(level);
            }), true);
        _.extend(ret.__proto__, e.group.prototype);
        return ret;
    };
    e.valMethods.prototype.dimPath = function() {
        return (this.parent ? this.parent.dimPath() + '/' : '') +
            (this.dim === 'Root' ? '' : this.dim);
    };
    e.valMethods.prototype.namePath = function() {
        return (this.parent ? this.parent.namePath() + '/' : '') +
            (this.toString() === 'All' ? '' : this);
    };
    e.valMethods.prototype.lookup = function(query) {
        if (_.isArray(query)) {
            if (this.toString() === query[0]) {
                query = query.slice(1);
                if (query.length === 0)
                    return this;
            }
        } else if (_.isString(query)) {
            if (this.toString() === query) {
                return this;
            }
        } else {
            throw new Error("invalid param: " + query);
        }
        if (!this.kids)
            throw new Error("can only call lookup on Values with kids");
        return this.kids.lookup(query);
    };
    e.valMethods.prototype.pct = function() {
        return this.records.length / this.parentList.records.length;
    };
    e.aggregate = function(list, numericDim) { 
        if (numericDim) {
            list = _(list).pluck(numericDim);
        }
        return _(list).reduce(function(memo,num){
                    memo.sum+=num;
                    memo.cnt++;
                    memo.avg=memo.sum/memo.cnt; 
                    memo.max = Math.max(memo.max, num);
                    return memo
                },{sum:0,cnt:0,max:-Infinity})
    }; 
    /* following is to support a particular use case of comparing
     * groups across two similar root nodes
     */
    e.diffGroup = function(from, to, dim, opts) {
        var fromGroup = e.group(from.records, dim, opts);
        var toGroup = e.group(to.records, dim, opts);
        var list = e.compare(fromGroup, toGroup, dim);
        list.dim = (opts && opts.dimName) ? opts.dimName : dim;
        _.extend(list.__proto__, e.group.prototype);
        if (opts && opts.asVal) {
        }
        return list;
    }
    e.compare = function(A, B, dim) {
        var a = _(A).map(function(d) { return d+'' });
        var b = _(B).map(function(d) { return d+'' });
        var comp = {};
        _(A).each(function(d, i) {
            comp[d+''] = {
                name: d+'',
                in: 'from',
                from: d,
                fromIdx: i,
                dim: dim,
            }
        });
        _(B).each(function(d, i) {
            if ((d+'') in comp) {
                var c = comp[d+''];
                c.in = "both";
                c.to = d;
                c.toIdx = i;
            } else {
                comp[d+''] = {
                    name: d+'',
                    in: 'to',
                    to: d,
                    toIdx: i,
                    dim: dim,
                }
            }
        });
        var list = _(comp).values().sort(function(a,b) {
            return (a.fromIdx - b.fromIdx) || (a.toIdx - b.toIdx);
        }).map(function(d) {
            var S = new String(d.name);
            _.extend(S, d);
            S.records = []
            if ('from' in d)
                S.records = S.records.concat(d.from.records);
            if ('to' in d)
                S.records = S.records.concat(d.to.records);
            return S;
        });
        _(list).map(function(d) {
            d.parentList = list; // NOT TESTED, NOT USED, PROBABLY WRONG
            d.records.parentVal = d; // NOT TESTED, NOT USED, PROBABLY WRONG
        });
        return list;
    }
    e.compareValue = function(from, to) {
        if (from.dim !== to.dim) {
            throw new Error("not sure what you're trying to do");
        }
        var name = from + ' to ' + to;
        var val = new String(name);
        val.from = from;
        val.to = to;
        val.depth = 0;
        val.in = "both";
        val.records = [].concat(from.records,to.records);
        val.records.parentVal = val; // NOT TESTED, NOT USED, PROBABLY WRONG
        val.dim = from.dim;
        _.extend(val.__proto__, e.valMethods.prototype);
        return val;
    };
    return e;
}());
