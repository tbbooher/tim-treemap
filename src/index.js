const dscc = require("@google/dscc");
const local = require("./localMessage.js");
const d3 = require("d3");

// change this to "true" for local development
// change this to "false" before deploying
// 
export const LOCAL = true;

function draw(message) {
    // let's get our data in a good format
    var data = message.tables.DEFAULT;

    var tabularData = data.map(function(row) {
        var accounts = {};
        accounts['account'] = row.account[0];
        accounts['market_value'] = row.account_value[0];
        accounts['percent_change'] = row.percent_change[0];
        accounts['investment'] = row.investment[0];
        return accounts;
    });

    var nestedData = d3
        .nest()
        .key(function(d) {
            return d['account'];
        })
        .key(function(d) {
            return d['investment'];
        })
        .rollup(function(leaves) {
            return {
                market_value: d3.sum(leaves, function(d) { return +d['market_value']; }),
                percent_change: d3.sum(leaves, function(d) { return +d['percent_change']; })
            }
        })
        .entries(tabularData);

    const root = d3.hierarchy({ values: nestedData }, (row) => {
        return row.values || null;
    });

    root.sum((d) => {
        return d.value && d.value.market_value || 0;
    });

    render(root, message.style);
};

function render(root, style) {
    // remove the canvas if it exists
    d3.select('body')
        .selectAll('svg')
        .remove();

    var max_value = d3.max(root.data['values'], function(d) { return +d.values[0].value.percent_change; });
    var min_value = d3.min(root.data['values'], function(d) { return +d.values[0].value.percent_change; });

    var myColor = d3
        .scaleLinear()
        .domain([min_value, max_value])
        .range(["red", "green"]);

    var height = dscc.getHeight();
    var width = dscc.getWidth();
    var mg_h = Math.max(5, height * 0.006);
    var mg_w = Math.max(5, width * 0.006);

    // set the dimensions and margins of the graph
    var margin = { top: mg_h, right: mg_w, bottom: mg_h, left: mg_w }

    width = width - margin.left - margin.right;
    height = height - margin.top - margin.bottom;

    var div = d3
        .select('body')
        .append('div')
        .attr('id', 'my_dataviz');

    var svg = div
        .append('svg')
        .attr('width', width - margin.left)
        .attr('height', height - margin.top)
        .append('g')
        .attr('transform', "translate(" + margin.left + "," + margin.top + ")");

    var treemap = d3
        .treemap()
        .size([
            width - margin.left - margin.right,
            height - margin.top - margin.bottom,
        ])
        // .paddingOuter(10)
        .paddingTop(28)
        .paddingRight(7)
        .paddingInner(3)
        (root)

    svg
        .selectAll("rect")
        .data(root.leaves())
        .enter()
        .append("rect")
        .attr('x', function(d) { return d.x0; })
        .attr('y', function(d) { return d.y0; })
        .attr('width', function(d) { return d.x1 - d.x0; })
        .attr('height', function(d) { return d.y1 - d.y0; })
        .style("stroke", "black")
        .style("fill", function(d) {
            var colorVal = d.data.value && d.data.value.percent_change;
            if (colorVal == 0) {
                return 'grey';
            } else {
                return myColor(colorVal);
            }
        });

    // and to add the text labels
    svg
        .selectAll("text")
        .data(root.leaves())
        .enter()
        .append("text")
        .attr("x", function(d) { return d.x0 + 5 }) // +10 to adjust position (more right)
        .attr("y", function(d) { return d.y0 + 20 }) // +20 to adjust position (lower)
        .text(function(d) {
            var width_percent = (d.x1 - d.x0) / width;
            if ((d.data.key == 'null') || (width_percent < 0.06)) {
                return '';
            } else {
                return d.data.key;
            }
        })
        .attr("fill", "white")

    // and to add the values in
    svg
        .selectAll("vals")
        .data(root.leaves())
        .enter()
        .append("text")
        .attr("x", function(d) { return d.x0 + 5 }) // +10 to adjust position (more right)
        .attr("y", function(d) { return d.y0 + 35 }) // +20 to adjust position (lower)
        .text(function(d) {
            var val = Math.round(parseFloat(d.data.value.market_value) / 1000);
            return val;
        })
        .attr("font-size", "11px")
        .attr("fill", "white");

    svg
        .selectAll("titles")
        .data(root.descendants().filter(function(d) { return d.depth == 1 }))
        .enter()
        .append("text")
        .attr("x", function(d) { return d.x0 })
        .attr("y", function(d) { return d.y0 + 21 })
        .text(function(d) {
            return d.data.key;
        })
        .attr("font-size", "19px");

}

// renders locally
if (LOCAL) {
    draw(local.message);
} else {
    dscc.subscribeToData(draw, { transform: dscc.objectTransform });
}