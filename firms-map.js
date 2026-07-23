(() => {
  "use strict";

  // Doğrulanmış firma kayıtları buraya eklendiğinde aynı veri hem tabloyu
  // hem de harita işaretlerini oluşturur. Doğrulanmamış kayıt eklenmez.
  const sellingFirms = Object.freeze([
    // {
    //   companyName: "Firma adı",
    //   website: "https://ornek.com",
    //   phone: "+90 ...",
    //   email: "ornek@firma.com",
    //   address: "Açık adres",
    //   latitude: 41.017,
    //   longitude: 28.97,
    //   verified: true,
    // },
  ]);

  const tableBody = document.querySelector("[data-firms-table-body]");
  const mapElement = document.querySelector("#firms-map");
  const mapStatus = document.querySelector("[data-firms-map-status]");

  if (!tableBody || !mapElement || !mapStatus) {
    return;
  }

  const verifiedFirms = sellingFirms.filter(
    (firm) => firm?.verified === true && typeof firm.companyName === "string",
  );

  const makeCell = (label) => {
    const cell = document.createElement("td");
    cell.dataset.label = label;
    return cell;
  };

  const makeContactLine = (iconClass, text, href) => {
    const line = href ? document.createElement("a") : document.createElement("span");
    line.className = "firms-contact-line";
    if (href) {
      line.href = href;
    }

    const icon = document.createElement("i");
    icon.className = `bi ${iconClass}`;
    icon.setAttribute("aria-hidden", "true");
    line.append(icon, document.createTextNode(text));
    return line;
  };

  const normaliseWebsite = (value) => {
    if (!value) {
      return null;
    }

    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url : null;
    } catch {
      return null;
    }
  };

  const renderTable = () => {
    if (verifiedFirms.length === 0) {
      return;
    }

    tableBody.replaceChildren();

    verifiedFirms.forEach((firm) => {
      const row = document.createElement("tr");

      const companyCell = makeCell("Şirket İsmi");
      const companyName = document.createElement("strong");
      companyName.textContent = firm.companyName;
      companyCell.append(companyName);

      const websiteCell = makeCell("Web adresi");
      const website = normaliseWebsite(firm.website);
      if (website) {
        const websiteLink = document.createElement("a");
        websiteLink.className = "firms-website-link";
        websiteLink.href = website.href;
        websiteLink.target = "_blank";
        websiteLink.rel = "noreferrer";
        websiteLink.append(
          document.createTextNode(website.hostname.replace(/^www\./, "")),
          Object.assign(document.createElement("i"), {
            className: "bi bi-arrow-up-right",
          }),
        );
        websiteCell.append(websiteLink);
      } else {
        websiteCell.textContent = "—";
      }

      const contactCell = makeCell("İletişim Bilgileri");
      const contactList = document.createElement("div");
      contactList.className = "firms-contact-list";

      if (firm.phone) {
        contactList.append(
          makeContactLine("bi-telephone", firm.phone, `tel:${firm.phone.replace(/\s/g, "")}`),
        );
      }
      if (firm.email) {
        contactList.append(makeContactLine("bi-envelope", firm.email, `mailto:${firm.email}`));
      }
      if (firm.address) {
        contactList.append(makeContactLine("bi-geo-alt", firm.address));
      }
      if (!contactList.childElementCount) {
        contactList.textContent = "—";
      }
      contactCell.append(contactList);

      row.append(companyCell, websiteCell, contactCell);
      tableBody.append(row);
    });
  };

  const buildPopup = (firm) => {
    const popup = document.createElement("div");
    popup.className = "firms-map-popup";

    const name = document.createElement("strong");
    name.textContent = firm.companyName;
    popup.append(name);

    if (firm.address) {
      const address = document.createElement("span");
      address.textContent = firm.address;
      popup.append(address);
    }

    const website = normaliseWebsite(firm.website);
    if (website) {
      const link = document.createElement("a");
      link.href = website.href;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Web sitesini aç";
      popup.append(link);
    }

    return popup;
  };

  const initialiseMap = () => {
    if (!window.L) {
      mapElement.classList.add("is-unavailable");
      mapStatus.classList.add("is-error");
      mapStatus.querySelector("span").textContent =
        "Harita şu anda yüklenemedi. Firma bilgilerini aşağıdaki listeden inceleyebilirsiniz.";
      return;
    }

    const map = window.L.map(mapElement, {
      scrollWheelZoom: false,
      zoomControl: true,
    }).setView([41.017, 28.97], 15);

    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanlar',
    }).addTo(map);

    const markerIcon = window.L.divIcon({
      className: "firms-map-marker",
      html: '<span class="firms-map-marker-core"><i class="bi bi-shop" aria-hidden="true"></i></span>',
      iconSize: [44, 52],
      iconAnchor: [22, 48],
      popupAnchor: [0, -44],
    });

    const markers = verifiedFirms
      .filter(
        (firm) => Number.isFinite(firm.latitude) && Number.isFinite(firm.longitude),
      )
      .map((firm) =>
        window.L.marker([firm.latitude, firm.longitude], { icon: markerIcon })
          .addTo(map)
          .bindPopup(buildPopup(firm)),
      );

    if (markers.length > 0) {
      const markerGroup = window.L.featureGroup(markers);
      map.fitBounds(markerGroup.getBounds(), { padding: [56, 56], maxZoom: 16 });
      mapStatus.querySelector("span").textContent = `${markers.length} yetkili satış noktası haritada gösteriliyor.`;
      mapStatus.classList.add("has-locations");
    }

    window.setTimeout(() => map.invalidateSize(), 120);
  };

  renderTable();
  initialiseMap();
})();
