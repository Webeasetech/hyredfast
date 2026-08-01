const StatCard = ({ title, value, icon }) => {
  return (
    <div className="border border-border bg-white p-4 flex flex-col items-center justify-between gap-3 rounded-lg">
      <div className="w-12 h-12 border border-border bg-accent flex items-center justify-center rounded-lg">
        {icon}
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-foreground">{title}</p>
      </div>
    </div>
  );
};

export default StatCard;
