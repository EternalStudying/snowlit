package xyz.snowlit.infrastructure.places;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import xyz.snowlit.story.PlaceSearch.FoundPlace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GeoapifyPlaceSearchTests {
    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();

    @Test
    void searchesWorldwideAndKeepsUsablePlacesOnce() {
        var search = new GeoapifyPlaceSearch(builder.build(), "test-key", "https://geocoder.example/");
        server.expect(requestTo("https://geocoder.example/v1/geocode/search?text=Eiffel%20Tower&format=json&lang=zh&limit=8&apiKey=test-key"))
                .andRespond(withSuccess("""
                    {"results":[
                      {"name":"埃菲尔铁塔;Tour Eiffel","address_line2":"巴黎, 法国","lat":48.8582602,"lon":2.2944991,"country_code":"fr"},
                      {"name":"埃菲尔铁塔","address_line2":"巴黎, 法国","lat":48.8583,"lon":2.2945,"country_code":"fr"},
                      {"address_line1":"Eiffel Tower Road","formatted":"Eiffel Tower Road, Example","lat":10,"lon":20,"country_code":"us"},
                      {"name":"No point"},
                      {"name":"Bad point","lat":95,"lon":20}
                    ]}
                    """, MediaType.APPLICATION_JSON));

        var places = search.search("Eiffel Tower").orElseThrow();

        assertThat(places).containsExactly(
                new FoundPlace("埃菲尔铁塔", "巴黎, 法国", 48.8582602, 2.2944991, "fr"),
                new FoundPlace("Eiffel Tower Road", "Eiffel Tower Road, Example", 10, 20, "us"));
        server.verify();
    }

    @Test
    void noKeyOrProviderFailureMeansUnavailableNotEmpty() {
        assertThat(new GeoapifyPlaceSearch(builder.build(), " ", "").search("西湖")).isEmpty();

        var search = new GeoapifyPlaceSearch(builder.build(), "test-key", "");
        server.expect(requestTo(org.hamcrest.Matchers.startsWith("https://api.geoapify.com/v1/geocode/search?")))
                .andRespond(withServerError());
        assertThat(search.search("西湖")).isEmpty();

        server.reset();
        server.expect(requestTo(org.hamcrest.Matchers.startsWith("https://api.geoapify.com/v1/geocode/search?")))
                .andRespond(withSuccess("{\"results\":[]}", MediaType.APPLICATION_JSON));
        assertThat(search.search("nowhere at all").orElseThrow()).isEmpty();
    }
}
