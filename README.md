### Explore CSV or JSON files from SQL queries or spreadsheets

TreeLike is an experimental tool providing a quick way to understand the
shape of multi-dimensional data in a tabular CSV or JSON file.

[Demo](https://rawgit.com/Sigfried/treelike/master/demo.html) (you'll need a data file, how about: [MySQL world data](https://rawgit.com/Sigfried/treelike/master/data/mysql_world_data.csv))

It immediately shows the distributions of values in all columns, and by
laying out the columns in some nesting order, can show hierarchical
relationships between values across columns. When two columns have a
many-to-many relationship, the merge feature shows connections in both
directions, not just from parent to child. And parent/child
relationships can be reordered with one or two mouse clicks.

TreeLike will be most helpful with files of between about 4 and
20 columns. It should be fine with at least tens of thousands of rows,
but it hasn't been well tested.

