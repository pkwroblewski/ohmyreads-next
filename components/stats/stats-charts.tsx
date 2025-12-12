"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReadingStats } from "@/lib/queries/stats";

interface StatsChartsProps {
  stats: ReadingStats;
}

// Vibrant color palette
const COLORS = [
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#ec4899", // pink
  "#10b981", // emerald
  "#f97316", // orange
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#a855f7", // purple
  "#eab308", // yellow
];

export default function StatsCharts({ stats }: StatsChartsProps) {
  const [timeView, setTimeView] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Reading Analytics</h2>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Books Over Time */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Reading Over Time</CardTitle>
                <CardDescription>Books and pages read</CardDescription>
              </div>
              <Tabs
                value={timeView}
                onValueChange={(v) => setTimeView(v as "monthly" | "yearly")}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="monthly" className="text-xs px-2">
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger value="yearly" className="text-xs px-2">
                    Yearly
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={
                    timeView === "monthly"
                      ? stats.monthlyReading
                      : stats.yearlyReading
                  }
                >
                  <defs>
                    <linearGradient id="colorBooks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop
                        offset="95%"
                        stopColor="#8b5cf6"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis
                    dataKey={timeView === "monthly" ? "month" : "year"}
                    className="text-xs"
                    tick={{ fill: "currentColor" }}
                  />
                  <YAxis className="text-xs" tick={{ fill: "currentColor" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="books"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#colorBooks)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Genre Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Genre Breakdown</CardTitle>
            <CardDescription>Your reading preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {stats.genreDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.genreDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="genre"
                    >
                      {stats.genreDistribution.map((entry, index) => (
                        <Cell
                          key={entry.genre}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value, name) => [`${value} books`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No genre data yet
                </div>
              )}
            </div>
            {/* Legend */}
            {stats.genreDistribution.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {stats.genreDistribution.slice(0, 6).map((genre, index) => (
                  <div
                    key={genre.genre}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-muted-foreground">{genre.genre}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rating Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Your Ratings</CardTitle>
            <CardDescription>How you rate books</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.ratingDistribution} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis type="number" tick={{ fill: "currentColor" }} />
                  <YAxis
                    type="category"
                    dataKey="rating"
                    tick={{ fill: "currentColor" }}
                    tickFormatter={(value) => `${value} ★`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => [`${value} books`, "Count"]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {stats.ratingDistribution.map((entry) => (
                      <Cell
                        key={entry.rating}
                        fill={
                          entry.rating >= 4
                            ? "#10b981"
                            : entry.rating === 3
                              ? "#f59e0b"
                              : "#ef4444"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Authors */}
        <Card>
          <CardHeader>
            <CardTitle>Most Read Authors</CardTitle>
            <CardDescription>Your favorite writers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.topAuthors.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No author data yet
                </p>
              ) : (
                stats.topAuthors.map((author, index) => (
                  <div key={author.author} className="flex items-center gap-4">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{author.author}</div>
                      <div className="text-sm text-muted-foreground">
                        {author.count} {author.count === 1 ? "book" : "books"}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <div
                        className="h-2 rounded-full bg-muted overflow-hidden"
                        style={{ width: "100px" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(author.count / stats.topAuthors[0].count) * 100}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

