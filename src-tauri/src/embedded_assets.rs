use flate2::read::GzDecoder;
use serde_json::Value;
use std::io::Read;

#[derive(Debug, thiserror::Error)]
pub(crate) enum EmbeddedAssetError {
    #[error("İstenen gömülü kütüphane tanımlı değil.")]
    Unknown,
    #[error("Gömülü kütüphane açılamadı: {0}")]
    Decode(String),
}

fn bytes(asset_id: &str) -> Result<&'static [u8], EmbeddedAssetError> {
    match asset_id {
        "product-engineering" => Ok(include_bytes!("../generated/product-engineering.json.gz")),
        "pfmea-engineering" => Ok(include_bytes!("../generated/pfmea-engineering.json.gz")),
        "bom-engineering" => Ok(include_bytes!("../generated/bom-engineering.json.gz")),
        "quality-document" => Ok(include_bytes!("../generated/quality-document.json.gz")),
        "operation-code" => Ok(include_bytes!("../generated/operation-code.json.gz")),
        "seed-processes" => Ok(include_bytes!("../generated/seed-processes.json.gz")),
        "machines-master" => Ok(include_bytes!("../generated/machines-master.json.gz")),
        _ => Err(EmbeddedAssetError::Unknown),
    }
}

pub(crate) fn value(asset_id: &str) -> Result<Value, EmbeddedAssetError> {
    let mut decoder = GzDecoder::new(bytes(asset_id)?);
    let mut json = String::new();
    decoder
        .read_to_string(&mut json)
        .map_err(|error| EmbeddedAssetError::Decode(error.to_string()))?;
    serde_json::from_str(&json).map_err(|error| EmbeddedAssetError::Decode(error.to_string()))
}

pub(crate) fn public_value(asset_id: &str) -> Result<Value, EmbeddedAssetError> {
    match asset_id {
        "product-engineering"
        | "pfmea-engineering"
        | "bom-engineering"
        | "quality-document"
        | "operation-code" => value(asset_id),
        _ => Err(EmbeddedAssetError::Unknown),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn public_asset_gate_does_not_expose_internal_seeds() {
        assert!(public_value("product-engineering").is_ok());
        assert!(matches!(
            public_value("seed-processes"),
            Err(EmbeddedAssetError::Unknown)
        ));
        assert!(matches!(
            public_value("machines-master"),
            Err(EmbeddedAssetError::Unknown)
        ));
    }
}
