---
layout: page
title: "index"
title: "TreeLike Browser"
date: 2013-12-24 14:41
comments: true
sharing: true
footer: true
project: true
reponame: treelike
cover: treelike_screenshot.png
---

### Explore CSV or JSON files from SQL queries or spreadsheets

TreeLike is an experimental tool providing a quick way to understand the
shape of the data in a CSV file.[^1]

[^1]: Or a spreadsheet or SQL query or SAS data set, or any other data arranged in rows and columns and saved as CSV or JSON. 

[Demo](../treelike/demo.html) (you'll need a data file, how about: [MySQL world data](https://raw.github.com/Sigfried/treelike/master/data/mysql_world_data.csv))

It immediately shows the distributions of values in all columns, and by
laying out the columns in some nesting order, can show hierarchical
relationships between values across columns. When two columns have a
many-to-many relationship, the merge feature shows connections in both
directions, not just from parent to child. And parent/child
relationships can be reordered with one or two mouse clicks.

To understand what it does, you need to see it in action. This rough
demo video will explain:

<iframe width="420" height="315" src="//www.youtube.com/embed/mJ8ljG8qpZk" frameborder="0" allowfullscreen></iframe>

TreeLike will be most helpful with files of between about 4 and
20 columns. It should be fine with at least tens of thousands of rows,
but it hasn't been well tested.

