import type { FC } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface RoleCount {
  role:  string
  count: number
}

interface Props {
  data: RoleCount[]
}

export const RoleDistributionChart: FC<Props> = ({ data }) => (
  <ResponsiveContainer width="100%" height={200}>
    <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#1E2A40" vertical={false} />
      <XAxis
        dataKey="role"
        tick={{ fill: '#6B7A99', fontSize: 12 }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        tick={{ fill: '#6B7A99', fontSize: 12 }}
        axisLine={false}
        tickLine={false}
        width={32}
      />
      <Tooltip
        cursor={{ fill: 'rgba(200,155,60,0.08)' }}
        contentStyle={{
          background: '#111827',
          border:     '1px solid #785a28',
          borderRadius: 8,
          color:       '#f0e6d3',
          fontSize:    12,
        }}
        formatter={(value: number) => [`${value}体`, 'チャンピオン数']}
      />
      <Bar dataKey="count" fill="#c89b3c" radius={[4, 4, 0, 0]} maxBarSize={48} />
    </BarChart>
  </ResponsiveContainer>
)
