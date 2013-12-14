'use strict';
var enlightenedData = (function() {
    var e = {};
    function Groups() {}
    Groups.prototype = new Array;
    function makeGroups(arr_arg) {
        var arr = [ ];
        arr.push.apply(arr, arr_arg);
        arr.__proto__ = Groups.prototype;
        addUnderscoreMethods(arr);
        //Object.defineProperty(arr, '_', { value: _(arr) });
        return arr;
    }
    function addUnderscoreMethods(obj) {
        var methods = [
                        "each",
                        "map",
                        "reduce",
                        "find",
                        "filter",
                        "reject",
                        "all",
                        "every",
                        "any",
                        "some",
                        "contains",
                        "invoke",
                        "pluck",
                        "where",
                        "findWhere",
                        "max",
                        "min",
                        "shuffle",
                        "sortBy",
                        "groupBy",
                        "countBy",
                        "sortedIndex",
                        "size",
                        "first",
                        "initial",
                        "last",
                        "rest",
                        "compact",
                        "flatten",
                        "without",
                        "uniq",
                        "union",
                        "intersection",
                        "difference",
                        "zip",
                        "unzip",
                        //"object",
                        "indexOf",
                        "lastIndexOf",
                        "chain",
                        "result"
                        ];
        _(methods).each(function(methodName) {
            Object.defineProperty(obj, methodName, {
                value: function() {
                    var part = _.partial(_[methodName], obj)
                    var result = part.apply(null, _.toArray(arguments));
                    if (_.isArray(result)) e.addGroupMethods(result);
                    return result;
                }})
        })
    }
    function Value() {}
    function makeValue(v_arg) {
        if (isNaN(v_arg)) {
            return makeStringValue(v_arg);
        } else {
            return makeNumberValue(v_arg);
        }
    }
    function StringValue() {}
    StringValue.prototype = new String;
    function makeStringValue(s_arg) {
        var S = new String(s_arg);
        S.__proto__ = StringValue.prototype;
        return S;
    }
    function NumberValue() {}
    NumberValue.prototype = new Number;
    function makeNumberValue(n_arg) {
        var N = new Number(n_arg);
        N.__proto__ = NumberValue.prototype;
        return N;
    }
    function wholeListNumeric(groups) {
        var isNumeric = _.every(_.keys(groups), function(k) {
            return      k === null ||
                        k === undefined ||
                        (!isNaN(Number(k))) ||
                        ["null", ".", "undefined"].indexOf(k.toLowerCase()) > -1
        });
        if (isNumeric) {
            _.each(_.keys(groups), function(k) {
                if (isNaN(k)) {
                    delete groups[k];        // getting rid of NULL values in dim list!!
                }
            });
        }
        return isNumeric;
    }
    var childProp = 'children';
    e.group = function(list, dim, opts) {
        opts = opts || {};
        childProp = opts.childProp || childProp;
        var recs = opts.preGroupRecsHook ? opts.preGroupRecsHook(list) : list;
        var g = _.groupBy(recs, dim);   // dim can be a function
        if (opts.excludeValues) {
            _(opts.excludeValues).each(function(d) {
                delete g[d];
            });
        }
        // shouldn't do this automatically, especially after being
        // able to specify type in opts
        var isNumeric = wholeListNumeric(g);
        var groups = _.map(_.pairs(g), function(pair, i) {
            var s = pair[0];
            var val;
            if(isNumeric) {
                val = makeNumberValue(s);
            } else {
                val = makeStringValue(s);
            }
            if (opts.dataType) { // not sure if this is ever used
                val = new opts.dataType(s);
            }
            val.records = e.addGroupMethods(pair[1]);
            val.dim = (opts.dimName) ? opts.dimName : dim;
            val.records.parentVal = val; // NOT TESTED, NOT USED, PROBABLY WRONG
            if (opts.parent)
                val.parent = opts.parent;
            if (val.parent) {
                if ('depth' in val.parent) {
                    val.depth = val.parent.depth + 1;
                } else {
                    val.parent.depth = 0;
                    val.depth = 1;
                }
            } else {
                val.depth = 0;
            }
            return val;
        });
        /*      moving recursion out to to the caler...
        if (opts.recurse) {
            groups = _(groups).map(function(g) { 
                if (childProp in g)
                    throw new Error(g + ' already has ' + childProp);
                g.depth = g.parent && g.parent.depth + 1 || 0;
                opts.parent = g;
                if (g.records.length) {
                    g[childProp] = e.group(g.records, dim, opts);
                }
                //if (opts.postGroupValHook) g = opts.postGroupValHook(g);
                return g;
            });
        }
        */
        groups = makeGroups(groups);
        groups.records = list; // NOT TESTED, NOT USED, PROBABLY WRONG
        groups.dim = (opts.dimName) ? opts.dimName : dim;
        groups.isNumeric = isNumeric;
        _(groups).each(function(g) { 
            g.parentList = groups 
        });
        // pointless without recursion
        //if (opts.postGroupGroupsHook) groups = opts.postGroupGroupsHook(groups);
        return groups;
    }

    Groups.prototype.asRootVal = function(name) {
        name = name || 'Root';
        var val = makeValue(name);
        val.records = e.addGroupMethods(this);
        val.dim = 'root';
        return val;
    }
    Groups.prototype.rawValues = function() {
        return _(this).map(function(d) { return d.toString() });
    };
    Groups.prototype.wrap = function() {
        return _(this);
    }
    Groups.prototype.lookup = function(query) {
        if (_.isArray(query)) {
            // if group has children, can search down the tree
            var values = query.slice(0);
            var list = this;
            var ret;
            while(values.length) {
                ret = this.singleLookup(values.shift());
                list = ret[childProp];
            }
            return ret;
        } else {
            return this.singleLookup(query);
        }
    };
    Groups.prototype.singleLookup = function(query) {
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
    Groups.prototype.flattenTree = function() {
        return _.chain(this)
                    .map(function(d) {
                        var desc = d.descendants();
                        return [d].concat(desc);
                    })
                    .flatten()
                    .filter(_.identity) // expunge nulls
                    .tap(e.addGroupMethods)
                    .value()
        return this.concat(_.flatten(_(this).invoke('descendants')));
    };
    Value.prototype.extendGroupBy = function(dim, opts) {
        _.each(this.leafNodes(), function(d) {
            opts.parent = d;
            if (d.in && d.in === "both") {
                d[childProp] = e.diffGroup(d.from, d.to, dim, opts);
            } else {
                d[childProp] = e.group(d.records, dim, opts);
                if (d.in ) {
                    _(d[childProp]).each(function(c) {
                        c.in = d.in;
                        c[d.in] = d[d.in];
                    });
                }
            }
            d[childProp].parentVal = d; // NOT TESTED, NOT USED, PROBABLY WRONG!!!
        });
    };
    Value.prototype.leafNodes = function(level) {
        var ret = [this];
        if (level !== 0 && this[childProp] && (!level || this.depth < level))
            ret = _.flatten(_.map(this[childProp], function(c) {
                return c.leafNodes(level);
            }), true);
        return makeGroups(ret);
    };
    /*  didn't make this yet, just copied from above
    Value.prototype.descendants = function(level) {
        var ret = [this];
        if (level !== 0 && this[childProp] && (!level || this.depth < level))
            ret = _.flatten(_.map(this[childProp], function(c) {
                return c.leafNodes(level);
            }), true);
        return makeGroups(ret);
    };
    */
    Value.prototype.dimPath = function() {
        return (this.parent ? this.parent.dimPath() + '/' : '') +
            (this.dim === 'Root' ? '' : this.dim);
    };
    Value.prototype.namePath = function(opts) {
        opts = opts || {};
        var path = this.pedigree(opts);
        if (opts.noRoot) path.shift();
        if (opts.backwards || this.backwards) path.reverse(); //kludgy?
        if (opts.asArray) return path;
        if (_(opts).has('delim')) return path.join(delim);
        return path.join('/');
        /*
        var delim = opts.delim || '/';
        return (this.parent ? 
                this.parent.namePath(_.extend({},opts,{notLeaf:true})) : '') +
            ((opts.noRoot && this.depth===0) ? '' : 
                (this + (opts.notLeaf ? delim : ''))
             )
        */
    };
    Value.prototype.pedigree = function(opts) {
        var path = [];
        if (!(opts && opts.notThis)) path.push(this);
        var ptr = this;
        while (ptr = ptr.parent) {
            path.unshift(ptr);
        }
        if (!(opts && opts.asValues)) return _(path).invoke('toString');
        return path;
    };
    Value.prototype.descendants = function(opts) {
        return this[childProp] ? this[childProp].flattenTree() : undefined;
        return _.reduce(this[childProp],
                function(desc, val) {
                    return desc.concat(val.descendants())
                },
                []);
    };
    Value.prototype.lookup = function(query) {
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
        if (!this[childProp])
            throw new Error("can only call lookup on Values with kids");
        return this[childProp].lookup(query);
    };
    Value.prototype.pct = function() {
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
     * used by treelike and some earlier code
     */
    e.diffGroup = function(from, to, dim, opts) {
        var fromGroup = e.group(from.records, dim, opts);
        var toGroup = e.group(to.records, dim, opts);
        var list = makeGroups(e.compare(fromGroup, toGroup, dim));
        list.dim = (opts && opts.dimName) ? opts.dimName : dim;
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
            var val = makeValue(d.name);
            _.extend(val, d);
            val.records = []
            if ('from' in d)
                val.records = val.records.concat(d.from.records);
            if ('to' in d)
                val.records = val.records.concat(d.to.records);
            return val;
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
        var val = makeValue(name);
        val.from = from;
        val.to = to;
        val.depth = 0;
        val.in = "both";
        val.records = [].concat(from.records,to.records);
        val.records.parentVal = val; // NOT TESTED, NOT USED, PROBABLY WRONG
        val.dim = from.dim;
        return val;
        //return Value(val);
    };
    _.extend(StringValue.prototype, Value.prototype);
    _.extend(NumberValue.prototype, Value.prototype);
    e.addGroupMethods = function(arr) {
        //_.extend(arr.__proto__, Groups.prototype);// pollutes global array prototype
        arr.__proto__ = Groups.prototype;
        addUnderscoreMethods(arr);
        //Object.defineProperty(arr, '_', { value: _(arr) });
        return arr;
    }
    return e;
}());
