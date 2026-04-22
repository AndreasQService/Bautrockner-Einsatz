"""
WohnungsScout – Datenbank Models & Setup
SQLite via SQLAlchemy
"""
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json, os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'wohnungsscout.db')
ENGINE = create_engine(f'sqlite:///{DB_PATH}', echo=False)
Session = sessionmaker(bind=ENGINE)
Base = declarative_base()


class Listing(Base):
    __tablename__ = 'listings'
    
    id            = Column(Integer, primary_key=True)
    source        = Column(String(50), nullable=False)    # 'newhome' | 'homegate'
    external_id   = Column(String(200), nullable=False)
    url           = Column(Text)
    title         = Column(Text)
    address       = Column(Text)
    city          = Column(String(100))
    zip_code      = Column(String(10))
    rooms         = Column(Float)
    area_m2       = Column(Integer)
    price_chf     = Column(Integer)
    has_parking   = Column(Boolean, default=False)
    has_balcony   = Column(Boolean, default=False)
    floor         = Column(String(20))
    description   = Column(Text)
    score         = Column(String(20), default='mittel')  # top/gut/mittel/schwach
    score_points  = Column(Integer, default=0)
    first_seen    = Column(DateTime, default=datetime.utcnow)
    last_seen     = Column(DateTime, default=datetime.utcnow)
    price_history = Column(Text, default='[]')            # JSON
    status        = Column(String(20), default='active')
    raw_json      = Column(Text)

    def price_history_list(self):
        try:
            return json.loads(self.price_history or '[]')
        except:
            return []

    def to_dict(self):
        return {
            'id': self.id,
            'source': self.source,
            'external_id': self.external_id,
            'url': self.url,
            'title': self.title,
            'address': self.address,
            'city': self.city,
            'zip_code': self.zip_code,
            'rooms': self.rooms,
            'area_m2': self.area_m2,
            'price_chf': self.price_chf,
            'has_parking': self.has_parking,
            'has_balcony': self.has_balcony,
            'floor': self.floor,
            'score': self.score,
            'score_points': self.score_points,
            'first_seen': self.first_seen.isoformat() if self.first_seen else None,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None,
            'price_history': self.price_history_list(),
            'status': self.status,
        }


class Favorite(Base):
    __tablename__ = 'favorites'
    id         = Column(Integer, primary_key=True)
    listing_id = Column(Integer)
    notes      = Column(Text)
    added_at   = Column(DateTime, default=datetime.utcnow)


class ScrapeLog(Base):
    __tablename__ = 'scrape_log'
    id            = Column(Integer, primary_key=True)
    source        = Column(String(50))
    started_at    = Column(DateTime, default=datetime.utcnow)
    finished_at   = Column(DateTime)
    new_count     = Column(Integer, default=0)
    updated_count = Column(Integer, default=0)
    error         = Column(Text)


def init_db():
    Base.metadata.create_all(ENGINE)
    print(f"[DB] Datenbank bereit: {DB_PATH}")
