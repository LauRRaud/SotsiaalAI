"use client";

export default function KovSummaryCards({ cards = [] }) {
  return (
    <div>
      <div>
        <div>
          {cards.map(card => (
            <div key={card.key}>
              <span>{card.label}</span>
              <div>
                <span>{card.value}</span>
                <span>{card.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
