create table if not exists horse (
    id uuid not null default gen_random_uuid() primary key,
    name varchar(30) not null,
    owner varchar(50),
    foaled date,
    ver int not null default 1,
    created timestamp not null default current_timestamp,
    lastupd timestamp not null default current_timestamp
);

create table if not exists jockey (
    id uuid not null default gen_random_uuid() primary key,
    name varchar(30) not null,
    age numeric(3) not null,
    licence varchar(30),
    ver int not null default 1,
    created timestamp not null default current_timestamp,
    lastupd timestamp not null default current_timestamp
);

create table if not exists race (
    id uuid not null default gen_random_uuid() primary key,
    race_no numeric(2) not null,
    race_date date not null,
    race_time time not null,
    racecourse varchar(30) not null,
    distance numeric(5),
    class varchar(2),
    runners numeric(2) not null,
    ver int not null default 1,
    created timestamp not null default current_timestamp,
    lastupd timestamp not null default current_timestamp
);

create table if not exists race_horse_jockey (
    id uuid not null default gen_random_uuid() primary key,
    race_id uuid not null references race(id),
    horse_id uuid not null references horse(id),
    jockey_id uuid not null references jockey(id),
    draw numeric(2) not null,
    ver int not null default 1,
    created timestamp not null default current_timestamp,
    lastupd timestamp not null default current_timestamp
);

create or replace view v_race_horse
as  
select 
    rhj.id, r.race_date, r.race_no,
    rhj.draw, h.name as horse, j.name as jockey,
    rhj.ver, rhj.created, rhj.lastupd
from race r 
join race_horse_jockey rhj on r.id = rhj.race_id
join horse h on rhj.horse_id = h.id
join jockey j on rhj.jockey_id = j.id;

create table if not exists odds_forecast (
    id uuid not null default gen_random_uuid() primary key,
    race_id uuid not null references race(id),
    first_leg numeric(2) not null,
    second_leg numeric(2) not null,
    odds numeric(5,3) not null,
    sts varchar(2) not null,
    ver int not null default 1,
    created timestamp not null default current_timestamp,
    lastupd timestamp not null default current_timestamp
);

create or replace procedure genForecastOdds(
    p_race_id uuid
) language plpgsql
as $$
declare
    v_runners integer;
    rec record;
begin
    select runners
    into v_runners 
    from race
    where id = p_race_id;

    for rec in 
        with random_horse as (
            select row_number() over() as rn, id, name from horse order by random()
        ), random_jockey as (
            select row_number() over() as rn, id, name from jockey order by random()
        )
        select h.rn, h.id as horse_id, h.name as horse_name, 
            j.id as jockey_id, j.name as jockey_name
        from random_horse h 
        join random_jockey j on h.rn = j.rn
        order by h.rn limit v_runners
    loop
        insert into race_horse_jockey (
            race_id, draw, horse_id, jockey_id
        ) values (
            p_race_id, rec.rn, rec.horse_id, rec.jockey_id
        );
    end loop;

    for fstLeg IN 1..v_runners loop
        for secLeg IN 1..v_runners loop
            if fstLeg <> secLeg then
                insert into odds_forecast (
                    race_id, first_leg, second_leg, odds, sts
                ) values (
                    p_race_id, fstLeg, secLeg, random()*100, 'OK'
                );
            end if;
        end loop;
    end loop;
end $$;

create or replace procedure updateRandomOdds(
    p_race_date date,
    p_race_no integer
) language plpgsql
as $$
declare
    legs integer ARRAY[2];
begin
    legs := array (
        select draw from v_race_horse
        where race_date = p_race_date
        and race_no = p_race_no
        order by random() limit 2
    );

    update odds_forecast 
    set odds = random()*100, 
        ver = ver + 1, 
        lastupd=current_timestamp
    where first_leg = legs[1] and second_leg = legs[2] 
    and race_id = (
        select id from race 
        where race_date = p_race_date 
        and race_no = p_race_no);
end $$;

do $$
declare
    race_id race.id%type;
    race_rec record;
begin
    insert into horse (
        name, owner
    ) values
        ('Best Life','Hemmings Racing'),
        ('Cave Article','Coral Racing Club'),
        ('Cave Bleu','Mrs C. Voce'),
        ('Clatterbridge','Hedgehoppers'),
        ('Entity of Substanz','Mr Colm Donlon'),
        ('Gentleman''s Relish','Lindsey Nash & The Famous Five'),
        ('Ginger Jonny','David Mason and Ginger Jonny Syndicate'),
        ('Grand Albert','Owners Group 123'),
        ('Jagwar','Mr John P. McManus'),
        ('Jukebox Fury','Middleham Park Racing XCIV'),
        ('Kentanddover','Graeme Moore,Kate & Andrew Brooks'),
        ('Leader In The Park','Lady Dulverton'),
        ('Mythe Bridge','Mrs S. M. Newell'),
        ('Paris Cercy','Mr Ian Charles Wilson'),
        ('The Dark Edge','The Dark Edge Partnership'),
        ('Cotoneaster','Noel Williams'),
        ('Horacio Apple''s','Highclere TB Racing-Apple and Dudgeon'),
        ('Stringtoyourbow','Gilman Int Plywood St Quinton S-Daniel'),
        ('Almazhar Grade','Arthur''s Party'),
        ('Presenting Jeremy','Got The Game Sewm Up'),
        ('Big Blue Moon','Barrett,Meredith,Panniers,Wilde'),
        ('Betterforeeveryone','Mr Rupert Anton'),
        ('Event of Sivola','CW Racing Club URSA Major Racing Ltd'),
        ('Roxboro Road','Mr M. E. Sowersby'),
        ('Mister Moodles','Mike and Eileen Newbould'),
        ('Paradias','Dodds-Smith,Farrel,Hodgson & Coupland'),
        ('Williethebuilder','Mrs Susan Carsberg'),
        ('Garitsa Bay','John Nicholls Racing'),
        ('Montys Soldier','Mr O. S. Harris'),
        ('Scout Master','DUDB Marketing Limited'),
        ('Selwan','Andy Bell & Fergus Lyons'),
        ('Skiffle Man','S T Racing - The Founders'' Syndicate'),
        ('Support Act','The M Team'),
        ('Ravanelli','A Night In Newmarket');

    insert into jockey (
        name, age
    ) values 
        ('Luke Scott',random()*30+20),
        ('Harry Bannister',random()*30+20),
        ('Richie McLernon',random()*30+20),
        ('Ben Jones',random()*30+20),
        ('Harry Skelton',random()*30+20),
        ('Niall Houlihan',random()*30+20),
        ('Caoilin Quinn',random()*30+20),
        ('Rob Hargreaves',random()*30+20),
        ('Tom Bellamy',random()*30+20),
        ('Marc Goldstein',random()*30+20),
        ('Rex Dingle',random()*30+20),
        ('Tabitha Worsley',random()*30+20),
        ('Jac Quinlan',random()*30+20),
        ('James Davies',random()*30+20),
        ('Freddie Gordon',random()*30+20),
        ('Lorcan Williams',random()*30+20),
        ('Freddie Gingell',random()*30+20),
        ('Micheal Nolan',random()*30+20),
        ('Bredan Powell',random()*30+20),
        ('Robert Dunne',random()*30+20),
        ('Alex JAry',random()*30+20),
        ('Paul Mulrennan',random()*30+20),
        ('Shane Gray',random()*30+20),
        ('Andrew Mullen',random()*30+20),
        ('Tom Eaves',random()*30+20),
        ('Jason Hart',random()*30+20),
        ('Joe Fanning',random()*30+20),
        ('Dougie Costello',random()*30+20),
        ('William Carver',random()*30+20),
        ('Phil Dennis',random()*30+20),
        ('Stan Sheppard',random()*30+20),
        ('Jamie Hamilton',random()*30+20),
        ('Carmeron Iles',random()*30+20),
        ('Charlie Maggs',random()*30+20),
        ('Ciaran Gethings',random()*30+20),
        ('Nico de Boinville',random()*30+20),
        ('Nick Scholfield',random()*30+20),
        ('Brian Hughes',random()*30+20),
        ('Robert Dunne',random()*30+20),
        ('Ned Fox',random()*30+20);

    insert into race (
        race_no, race_date, race_time, racecourse, runners
    ) values
        (1, '09-feb-2024', '13:32', 'Wolverhampton', 5),
        (2, '09-feb-2024', '14:02', 'Wolverhampton', 7),
        (3, '09-feb-2024', '14:32', 'Wolverhampton', 22),
        (4, '09-feb-2024', '14:32', 'Wolverhampton', 13),
        (5, '09-feb-2024', '14:32', 'Wolverhampton', 17),
        (1, '10-feb-2024', '15:35', 'Newcastle', 9),
        (2, '10-feb-2024', '16:10', 'Newcastle', 12),
        (3, '10-feb-2024', '16:45', 'Newcastle', 16);

    for race_rec in
        select * from race
        loop
            call genForecastOdds(race_rec.id);
        end loop;
    
    /*
    insert into races (
        race_no, race_date, race_time, venue
    ) values (
        1, '03-feb-2024', '14:30', 'Sandown'
    ) returning id into race_id;

    insert into odds_forecast (
        race_id, first_leg, second_leg, odds, sts
    ) values
        (race_id,1,2,random()*100,'OK'),
        (race_id,1,3,random()*100,'OK'),
        (race_id,1,4,random()*100,'OK'),
        (race_id,1,5,random()*100,'OK'),
        (race_id,1,6,random()*100,'OK'),
        (race_id,1,7,random()*100,'OK'),
        (race_id,2,1,random()*100,'OK'),
        (race_id,2,3,random()*100,'OK'),
        (race_id,2,4,random()*100,'OK'),
        (race_id,2,5,random()*100,'OK'),
        (race_id,2,6,random()*100,'OK'),
        (race_id,2,7,random()*100,'OK'),
        (race_id,3,1,random()*100,'OK'),
        (race_id,3,2,random()*100,'OK'),
        (race_id,3,4,random()*100,'OK'),
        (race_id,3,5,random()*100,'OK'),
        (race_id,3,6,random()*100,'OK'),
        (race_id,3,7,random()*100,'OK'),
        (race_id,4,1,random()*100,'OK'),
        (race_id,4,2,random()*100,'OK'),
        (race_id,4,3,random()*100,'OK'),
        (race_id,4,5,random()*100,'OK'),
        (race_id,4,6,random()*100,'OK'),
        (race_id,4,7,random()*100,'OK'),
        (race_id,5,1,random()*100,'OK'),
        (race_id,5,2,random()*100,'OK'),
        (race_id,5,3,random()*100,'OK'),
        (race_id,5,4,random()*100,'OK'),
        (race_id,5,6,random()*100,'OK'),
        (race_id,5,7,random()*100,'OK'),
        (race_id,6,1,random()*100,'OK'),
        (race_id,6,2,random()*100,'OK'),
        (race_id,6,3,random()*100,'OK'),
        (race_id,6,4,random()*100,'OK'),
        (race_id,6,5,random()*100,'OK'),
        (race_id,6,7,random()*100,'OK'),
        (race_id,7,1,random()*100,'OK'),
        (race_id,7,2,random()*100,'OK'),
        (race_id,7,3,random()*100,'OK'),
        (race_id,7,4,random()*100,'OK'),
        (race_id,7,5,random()*100,'OK'),
        (race_id,7,6,random()*100,'OK');
    */
end;$$