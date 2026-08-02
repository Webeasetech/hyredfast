const StatCard = ({ title, value, icon }) => {
  return (
    <div className="flex-1 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{title}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
};

export default StatCard;
