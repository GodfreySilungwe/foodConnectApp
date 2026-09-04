'use client';

import Link from 'next/link';
import '@/styles/components/SchoolCard.css';

export default function SchoolCard({ school }) {
  return (
    <Link href={`/schools/${school.id}`} className="school-card">
      <div className="school-card-icon">
        {school.image ? (
          <img src={school.image} alt={school.name} />
        ) : (
          <span>🏫</span>
        )}
      </div>
      <div className="school-card-body">
        <h4 className="school-card-name">{school.name}</h4>
        <p className="school-card-location">📍 {school.location || 'Location not specified'}</p>
        <p className="school-card-students">
          👨‍🎓 {school.studentCount || 0} students
        </p>
        <div className="school-card-footer">
          <span className="school-card-providers">
            {school.providerCount || 0} providers
          </span>
          <span className="school-card-view">View →</span>
        </div>
      </div>
    </Link>
  );
}