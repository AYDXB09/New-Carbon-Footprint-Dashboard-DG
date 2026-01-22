/**
 * Carbon Footprint Dashboard - Charts Module
 * Plotly.js visualizations for simulation results
 */

/**
 * Create all charts for the results display
 */
function createCharts(stats) {
    createDistributionChart(stats.rawData);
    createCategoryChart(stats);
}

/**
 * Create frequency distribution histogram (Figure 1 recreation)
 */
function createDistributionChart(data) {
    const chartDiv = document.getElementById('distributionChart');

    // Calculate percentiles for markers
    const sortedData = [...data].sort((a, b) => a - b);
    const p5 = percentile(sortedData, 5);
    const p50 = percentile(sortedData, 50);
    const p95 = percentile(sortedData, 95);

    // Create histogram trace
    const histogramTrace = {
        x: data,
        type: 'histogram',
        nbinsx: 50,
        marker: {
            color: '#00d4aa',
            line: {
                color: '#00a88a',
                width: 1
            }
        },
        opacity: 0.8,
        name: 'Frequency'
    };

    // Create vertical lines for percentiles
    const maxFreq = Math.max(...data) / 20; // Approximate max frequency

    const layout = {
        title: {
            text: 'Monte Carlo Simulation Results',
            font: {
                family: 'Inter, sans-serif',
                size: 16,
                color: '#ffffff'
            }
        },
        xaxis: {
            title: {
                text: 'Total Emissions (kg CO₂)',
                font: { color: '#a0a0a0' }
            },
            tickfont: { color: '#a0a0a0' },
            gridcolor: '#333333',
            zerolinecolor: '#333333'
        },
        yaxis: {
            title: {
                text: 'Frequency',
                font: { color: '#a0a0a0' }
            },
            tickfont: { color: '#a0a0a0' },
            gridcolor: '#333333',
            zerolinecolor: '#333333'
        },
        paper_bgcolor: '#1e1e1e',
        plot_bgcolor: '#1e1e1e',
        font: {
            family: 'Inter, sans-serif',
            color: '#ffffff'
        },
        showlegend: false,
        margin: { t: 50, r: 20, b: 60, l: 60 },
        shapes: [
            // 5th percentile line
            {
                type: 'line',
                x0: p5, x1: p5,
                y0: 0, y1: 1,
                yref: 'paper',
                line: {
                    color: '#4da6ff',
                    width: 2,
                    dash: 'dash'
                }
            },
            // Median line
            {
                type: 'line',
                x0: p50, x1: p50,
                y0: 0, y1: 1,
                yref: 'paper',
                line: {
                    color: '#00d4aa',
                    width: 3
                }
            },
            // 95th percentile line
            {
                type: 'line',
                x0: p95, x1: p95,
                y0: 0, y1: 1,
                yref: 'paper',
                line: {
                    color: '#ff4d4d',
                    width: 2,
                    dash: 'dash'
                }
            }
        ],
        annotations: [
            {
                x: p5,
                y: 1.05,
                yref: 'paper',
                text: '5th %ile',
                showarrow: false,
                font: { color: '#4da6ff', size: 10 }
            },
            {
                x: p50,
                y: 1.05,
                yref: 'paper',
                text: 'Median',
                showarrow: false,
                font: { color: '#00d4aa', size: 10 }
            },
            {
                x: p95,
                y: 1.05,
                yref: 'paper',
                text: '95th %ile',
                showarrow: false,
                font: { color: '#ff4d4d', size: 10 }
            }
        ]
    };

    const config = {
        responsive: true,
        displayModeBar: false
    };

    Plotly.newPlot(chartDiv, [histogramTrace], layout, config);
}

/**
 * Create category breakdown bar chart
 */
function createCategoryChart(stats) {
    const chartDiv = document.getElementById('categoryChart');

    const categories = ['Device', 'Zoom', 'Canvas', 'Tools'];
    const lowest = [stats.device.lowest, stats.zoom.lowest, stats.canvas.lowest, stats.tools.lowest];
    const median = [stats.device.median, stats.zoom.median, stats.canvas.median, stats.tools.median];
    const highest = [stats.device.highest, stats.zoom.highest, stats.canvas.highest, stats.tools.highest];

    const traceLowest = {
        x: categories,
        y: lowest,
        name: 'Lowest',
        type: 'bar',
        marker: {
            color: '#4da6ff'
        }
    };

    const traceMedian = {
        x: categories,
        y: median,
        name: 'Most Likely',
        type: 'bar',
        marker: {
            color: '#00d4aa'
        }
    };

    const traceHighest = {
        x: categories,
        y: highest,
        name: 'Highest',
        type: 'bar',
        marker: {
            color: '#ff4d4d'
        }
    };

    const layout = {
        barmode: 'group',
        xaxis: {
            tickfont: { color: '#a0a0a0' },
            gridcolor: '#333333'
        },
        yaxis: {
            title: {
                text: 'Emissions (kg CO₂)',
                font: { color: '#a0a0a0' }
            },
            tickfont: { color: '#a0a0a0' },
            gridcolor: '#333333',
            zerolinecolor: '#333333'
        },
        paper_bgcolor: '#1e1e1e',
        plot_bgcolor: '#1e1e1e',
        font: {
            family: 'Inter, sans-serif',
            color: '#ffffff'
        },
        legend: {
            orientation: 'h',
            y: -0.2,
            font: { color: '#a0a0a0' }
        },
        margin: { t: 20, r: 20, b: 80, l: 60 }
    };

    const config = {
        responsive: true,
        displayModeBar: false
    };

    Plotly.newPlot(chartDiv, [traceLowest, traceMedian, traceHighest], layout, config);
}

/**
 * Helper: Calculate percentile from sorted array
 */
function percentile(arr, p) {
    const index = (p / 100) * (arr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (upper >= arr.length) return arr[arr.length - 1];
    return arr[lower] * (1 - weight) + arr[upper] * weight;
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createCharts, createDistributionChart, createCategoryChart };
}
