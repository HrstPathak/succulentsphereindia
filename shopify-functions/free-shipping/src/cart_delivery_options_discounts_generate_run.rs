use super::schema;

use shopify_function::prelude::*;
use shopify_function::Result;

#[shopify_function]
fn cart_delivery_options_discounts_generate_run(
  input: schema::cart_delivery_options_discounts_generate_run::Input,
) -> Result<schema::CartDeliveryOptionsDiscountsGenerateRunResult> {
  let has_shipping_discount_class = input
    .discount()
    .discount_classes()
    .contains(&schema::DiscountClass::Shipping);

  if !has_shipping_discount_class {
    return Ok(schema::CartDeliveryOptionsDiscountsGenerateRunResult { operations: vec![] });
  }

  let qualifies = input.cart().lines().iter().any(|line| {
    match line.merchandise() {
      schema::cart_delivery_options_discounts_generate_run::input::cart::lines::merchandise::Merchandise::ProductVariant(
        variant,
      ) => variant.product().has_any_tag(),
      _ => false,
    }
  });

  if !qualifies {
    return Ok(schema::CartDeliveryOptionsDiscountsGenerateRunResult { operations: vec![] });
  }

  let mut candidates = Vec::new();
  for group in input.cart().delivery_groups().iter() {
    candidates.push(schema::DeliveryDiscountCandidate {
      targets: vec![schema::DeliveryDiscountCandidateTarget::DeliveryGroup(
        schema::DeliveryGroupTarget {
          id: group.id().clone(),
        },
      )],
      value: schema::DeliveryDiscountCandidateValue::Percentage(schema::Percentage {
        value: Decimal(100.0),
      }),
      message: Some("FREE SHIPPING".to_string()),
      associated_discount_code: None,
    });
  }

  Ok(schema::CartDeliveryOptionsDiscountsGenerateRunResult {
    operations: vec![schema::DeliveryOperation::DeliveryDiscountsAdd(
      schema::DeliveryDiscountsAddOperation {
        selection_strategy: schema::DeliveryDiscountSelectionStrategy::All,
        candidates,
      },
    )],
  })
}
