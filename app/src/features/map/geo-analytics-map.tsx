import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { formatNumber } from "@/lib/format";
import { getCityLabel } from "@/lib/location-codes";
import type { CityGeoDatum } from "@/lib/realestate/types";
import { CurrencyValue } from "@/components/ui/currency-value";

type Props = {
  locale: Locale;
  messages: LocaleMessages;
  data: CityGeoDatum[];
};

export function GeoAnalyticsMap({ locale, messages, data }: Props) {
  return (
    <MapContainer
      center={[24.7136, 46.6753]}
      zoom={6}
      className="h-[380px] w-full rounded-xl border border-border/70"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {data.map((city) => (
        <CircleMarker
          key={city.cityCode}
          center={[city.latitude, city.longitude]}
          radius={8 + city.count * 0.8}
          pathOptions={{
            color: "#22d3ee",
            fillColor: "#22d3ee",
            fillOpacity: 0.45,
            weight: 1
          }}
        >
          <Popup>
            <div className="space-y-1 text-xs">
              <p className="font-semibold">{getCityLabel(city.cityCode, locale)}</p>
              <p>
                {messages.kpi.total_listings}: {formatNumber(city.count, locale)}
              </p>
              <p>
                {messages.kpi.median_price_per_m2}:{" "}
                <span className="inline-flex items-center gap-1">
                  <CurrencyValue value={city.avgPricePerM2} locale={locale} />
                  <span>/ m²</span>
                </span>
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
