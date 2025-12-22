/*
CREATE TABLE vereine (
    id SERIAL PRIMARY KEY,
    vereinsname TEXT NOT NULL);

	SELECT tablename FROM pg_catalog.pg_tables
	WHERE schemaname = 'public';

CREATE TABLE zeiten (
    id SERIAL PRIMARY KEY,
    zeit TIMESTAMP WITHOUT TIME ZONE
);

CREATE TABLE spiele (
   id SERIAL PRIMARY KEY,
   anstoss TIMESTAMP WITHOUT TIME ZONE,
   heimverein TEXT NOT NULL,
   gastverein TEXT NOT NULL,
   heimtore INTEGER ,
   gasttore INTEGER ,
   statuswort TEXT NOT NULL
);

CREATE TABLE users(
Id serial primary key,
name TEXT NOT NULL,
password TEXT NOT NULL,
role TEXT NOT NULL
);






*/


