import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";

interface ChartDataPoint {
  date: string;
  mintVolume?: number;
  burnVolume?: number;
  mintCount?: number;
  burnCount?: number;
  customerCount?: number;
  totalCustomers?: number;
  restrictionCount?: number;
  totalRestrictions?: number;
}

interface ChartAreaConfig {
  dataKey: string;
  name: string;
  stroke: string;
  fill: string;
  fillOpacity?: number;
  strokeOpacity?: number;
}

interface ChartConfig {
  areas: ChartAreaConfig[];
  tooltipSuffix: string;
}

interface TokenActivityChartProps {
  type: "volume" | "count" | "customers" | "restrictions";
  highlight?: "mints" | "burns";
  days?: number;
  height?: number;
  className?: string;
}

export const TokenActivityChart = ({
  type = "volume",
  highlight,
  days = 30,
  height = 300,
  className = ""
}: TokenActivityChartProps) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ChartDataPoint[]>([]);

  // Attempt to get the DaisyUI theme color from CSS variables
  const getColorFromTheme = (variables: string[], opacity = 1): string => {
    if (typeof window === 'undefined') return '';

    const themeElement = document.querySelector('[data-theme]') || document.documentElement;
    const rootStyles = getComputedStyle(themeElement);
    
    for (const variable of variables) {
      const val = rootStyles.getPropertyValue(variable).trim();
      if (val) {
        if (val.startsWith("oklch(") && opacity !== 1) {
          const insertPos = val.lastIndexOf(")");
          return val.slice(0, insertPos) + ` / ${opacity})`;
        }
        return opacity !== 1 ? `${val.slice(0, -1)} / ${opacity})` : val;
      }
    }

    console.warn(`Could not find color for variables:`, variables);
    return `oklch(50% 0 0 / ${opacity})`; // Neutral gray fallback
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/chart-data?type=${type}&days=${days}`);
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch chart data");
        }
        const result = await response.json();
        setData(result.chartData);
      } catch (error) {
        console.error("Error fetching chart data:", error);
        toast.error(error instanceof Error ? error.message : "Failed to fetch chart data");
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days, type]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height: `${height}px` }}>
        <div className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className={`flex items-center justify-center bg-base-200 rounded-lg ${className}`} style={{ height: `${height}px` }}>
        <div className="text-base-content/70 text-center">
          <p>No data available for this period</p>
          <p className="text-sm mt-1">Try selecting a different time range</p>
        </div>
      </div>
    );
  }

  const primaryColor = getColorFromTheme(['--color-primary', '--p']);
  const secondaryColor = getColorFromTheme(['--color-secondary', '--s']);
  const errorColor = getColorFromTheme(['--color-error', '--er']);
  const warningColor = getColorFromTheme(['--color-warning', '--wa']);

  console.log('Theme colors:', {
    primary: primaryColor,
    secondary: secondaryColor,
    error: errorColor,
    warning: warningColor
  });

  const getChartConfig = (): ChartConfig => {
    switch (type) {
      case 'volume':
        return {
          areas: [
            {
              dataKey: 'mintVolume',
              name: 'Mints',
              stroke: primaryColor,
              fill: primaryColor,
              fillOpacity: 0.2
            },
            {
              dataKey: 'burnVolume',
              name: 'Burns',
              stroke: errorColor,
              fill: errorColor,
              fillOpacity: 0.2
            }
          ],
          tooltipSuffix: ' MNEE'
        };
      case 'count': {
        const areas: ChartAreaConfig[] = [];
        
        // Always add mints unless specifically highlighting burns
        if (!highlight || highlight === 'mints') {
          areas.push({
            dataKey: 'mintCount',
            name: 'Mints',
            stroke: primaryColor,
            fill: primaryColor,
            fillOpacity: 0.2,
            strokeOpacity: 1
          });
        }

        // Always add burns unless specifically highlighting mints
        if (!highlight || highlight === 'burns') {
          areas.push({
            dataKey: 'burnCount',
            name: 'Burns',
            stroke: errorColor,
            fill: errorColor,
            fillOpacity: 0.2,
            strokeOpacity: 1
          });
        }

        return {
          areas,
          tooltipSuffix: ' transactions'
        };
      }
      case 'customers':
        return {
          areas: [
            {
              dataKey: 'customerCount',
              name: 'New Customers',
              stroke: primaryColor,
              fill: primaryColor,
              fillOpacity: 0.2
            },
            {
              dataKey: 'totalCustomers',
              name: 'Total Customers',
              stroke: secondaryColor,
              fill: secondaryColor,
              fillOpacity: 0.2
            }
          ],
          tooltipSuffix: ' customers'
        };
      case 'restrictions':
        return {
          areas: [
            {
              dataKey: 'restrictionCount',
              name: 'New Restrictions',
              stroke: errorColor,
              fill: errorColor,
              fillOpacity: 0.2
            },
            {
              dataKey: 'totalRestrictions',
              name: 'Total Restrictions',
              stroke: warningColor,
              fill: warningColor,
              fillOpacity: 0.2
            }
          ],
          tooltipSuffix: ' restrictions'
        };
    }
  };

  const chartConfig = getChartConfig();

  const formatValue = (value: number) => {
    return value.toLocaleString();
  };

  const formatTooltipValue = (value: number) => {
    return `${value.toLocaleString()}${chartConfig.tooltipSuffix}`;
  };

  interface TooltipProps {
    active?: boolean;
    payload?: Array<{
      value: number;
      name: string;
      stroke: string;
    }>;
    label?: string;
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-base-200 p-4 rounded-lg shadow-lg border border-base-300">
          <p className="font-medium mb-2">{format(parseISO(label || ''), "MMM d, yyyy")}</p>
          {payload.map((entry) => (
            <p key={entry.name} className="text-sm">
              <span
                className="inline-block w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: entry.stroke }}
              />
              {entry.name}: {formatTooltipValue(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={className}>
      <div className="bg-base-200 rounded-lg p-4">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart
            data={data}
            margin={{
              top: 10,
              right: 30,
              left: 10,
              bottom: 0,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-base-content/10" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => format(parseISO(date), "MMM d")}
              className="text-base-content/70"
              interval="preserveStartEnd"
              tickCount={5}
            />
            <YAxis
              className="text-base-content/70"
              tickFormatter={formatValue}
              domain={[0, 'auto']}
              allowDecimals={true}
              scale="linear"
              padding={{ top: 20 }}
              width={50}
              tickCount={5}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {chartConfig.areas.map((area) => (
              <Area
                key={area.dataKey}
                type="monotone"
                dataKey={area.dataKey}
                name={area.name}
                stroke={area.stroke}
                fill={area.fill}
                fillOpacity={area.fillOpacity}
                strokeWidth={2}
                animationDuration={300}
                isAnimationActive={true}
                connectNulls={true}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};