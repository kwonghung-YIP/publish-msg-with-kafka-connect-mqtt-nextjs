create table if not exists races (
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

create table if not exists odds_forecast (
    id uuid not null default gen_random_uuid() primary key,
    race_id uuid not null references races(id),
    first_leg numeric(2) not null,
    second_leg numeric(2) not null,
    odds numeric(5,3) not null,
    sts varchar(2) not null,
    ver int not null default 1,
    created timestamp not null default current_timestamp,
    lastupd timestamp not null default current_timestamp
);

create or replace procedure genForecastOdds(
    race_id uuid
) language plpgsql
as $$
declare
    v_runners integer;
begin
    select race_id, runners
    into race_id, v_runners 
    from races
    where race_id = race_id;

    for fstLeg IN 1..v_runners loop
        for secLeg IN 1..v_runners loop
            if fstLeg <> secLeg then
                insert into odds_forecast (
                    race_id, first_leg, second_leg, odds, sts
                ) values (
                    race_id, fstLeg, secLeg, random()*100, 'OK'
                );
            end if;
        end loop;
    end loop;
end $$;

do $$
declare
    race_id races.id%type;
    race_rec record;
begin
    insert into races (
        race_no, race_date, race_time, racecourse, runners
    ) values
        (1, '09-feb-2024', '13:32', 'Wolverhampton', 11),
        (2, '09-feb-2024', '14:02', 'Wolverhampton', 7),
        (3, '09-feb-2024', '14:32', 'Wolverhampton', 15),
        (1, '10-feb-2024', '15:35', 'Newcastle', 9),
        (2, '10-feb-2024', '16:10', 'Newcastle', 12),
        (3, '10-feb-2024', '16:45', 'Newcastle', 16);

    for race_rec in
        select * from races
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