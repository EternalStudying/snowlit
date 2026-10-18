package xyz.snowlit.home;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface HomeMapper {

    @Select("""
            select id, partner_a_name, partner_b_name, started_on, anniversary_on, slogan
            from couples
            order by id
            limit 1
            """)
    @Results(id = "homeCoupleMap", value = {
            @Result(column = "partner_a_name", property = "personA"),
            @Result(column = "partner_b_name", property = "personB"),
            @Result(column = "started_on", property = "startDate"),
            @Result(column = "anniversary_on", property = "anniversaryDate")
    })
    Couple findCouple();

    @Select("""
            select id as user_id, couple_role as role,
                   home_latitude as latitude, home_longitude as longitude,
                   home_city as city, home_district as district, home_province as province,
                   home_country as country, home_weather as weather, home_temperature as temperature,
                   last_online_at
            from users
            where couple_role = #{role}
            limit 1
            """)
    @Results(id = "homeUserLocationMap", value = {
            @Result(column = "user_id", property = "userId"),
            @Result(column = "last_online_at", property = "lastOnlineAt")
    })
    HomeLocation findLocationByRole(String role);

    @Update("""
            update users
            set couple_role = #{role},
                home_latitude = #{latitude},
                home_longitude = #{longitude},
                home_city = #{city},
                home_district = #{district},
                home_province = #{province},
                home_country = #{country},
                home_weather = #{weather},
                home_temperature = #{temperature},
                last_online_at = #{lastOnlineAt}
            where id = #{userId}
            """)
    int upsertLocation(HomeLocation location);
}
