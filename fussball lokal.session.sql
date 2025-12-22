/*select * from zeiten;

CREATE TABLE vereine (
    id SERIAL PRIMARY KEY,
    vereinsname TEXT NOT NULL
);


CREATE TABLE spiele (
   id SERIAL PRIMARY KEY,
   anstoss TIMESTAMP WITHOUT TIME ZONE,
   heimverein TEXT NOT NULL,
   gastverein TEXT NOT NULL,
   statuswort TEXT NOT NULL
);

DROP TABLE termine;

	SELECT tablename FROM pg_catalog.pg_tables
	WHERE schemaname = 'public';

DROP TABLE spiele;
*/
CREATE TABLE spiele (
   id SERIAL PRIMARY KEY,
   anstoss TIMESTAMP WITHOUT TIME ZONE,
   heimverein TEXT NOT NULL,
   gastverein TEXT NOT NULL,
   statuswort TEXT NOT NULL
);
