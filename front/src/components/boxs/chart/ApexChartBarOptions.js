const getApexChartBarOptions = ({ displayAxes, series, colors, locales, defaultLocale }) => {
  const options = {
    chart: {
      locales,
      defaultLocale,
      type: 'bar',
      fontFamily: 'inherit',
      height: displayAxes ? 200 : 100,
      parentHeightOffset: 0,
      toolbar: {
        show: false
      },
      sparkline: {
        enabled: !displayAxes
      },
      animations: {
        enabled: false
      },
      stacked: true
    },
    plotOptions: {
      bar: {
        columnWidth: '100%'
      }
    },
    dataLabels: {
      enabled: false
    },
    fill: {
      opacity: 1
    },
    series,
    grid: {
      padding: {
        top: -20,
        right: 0,
        left: -4,
        bottom: -4
      },
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: true
        }
      }
    },
    xaxis: {
      labels: {
        padding: 0,
        datetimeUTC: false
      },
      tooltip: {
        enabled: false
      },
      axisBorder: {
        show: false
      },
      type: 'datetime'
    },
    yaxis: {
      labels: {
        padding: 4,
        formatter: function(value) {
          if (Math.abs(value) < 1) {
            return value; // For very low values, like crypto prices, use the normal value
          } else {
            return value.toFixed(2); // 2 decimal places for other values
          }
        }
      }
    },
    colors,
    legend: {
      show: displayAxes,
      position: 'bottom'
    }
  };
  return options;
};

export { getApexChartBarOptions };
