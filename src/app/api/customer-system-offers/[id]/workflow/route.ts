import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  CustomerOfferWorkflowError,
  getCustomerOfferWorkflowDetail,
  runCustomerOfferWorkflow,
} from "@/lib/customer-offer-stock-workflow";

import type {
  CustomerOfferWorkflowAction,
  CustomerOfferWorkflowRequest,
} from "@/types/customer-offer-workflow";

interface RouteContext {
  params:
    Promise<{
      id: string;
    }>;
}

function isWorkflowAction(
  value: unknown
): value is CustomerOfferWorkflowAction {
  return (
    value ===
      "start-sale" ||
    value ===
      "order-completed" ||
    value ===
      "complete-sale"
  );
}

function errorResponse(
  error: unknown
) {
  if (
    error instanceof
    CustomerOfferWorkflowError
  ) {
    return NextResponse.json(
      {
        success:
          false,
        message:
          error.message,
        ...(error.offer
          ? {
              data:
                error.offer,
            }
          : {}),
        ...(error.stockRequirements
          ? {
              stockRequirements:
                error.stockRequirements,
            }
          : {}),
      },
      {
        status:
          error.statusCode,
      }
    );
  }

  console.error(
    "Customer offer workflow error:",
    error
  );

  return NextResponse.json(
    {
      success:
        false,
      message:
        error instanceof Error
          ? error.message
          : "Teklif iş akışı tamamlanamadı.",
    },
    {
      status:
        500,
    }
  );
}

export async function GET(
  _request:
    NextRequest,
  context:
    RouteContext
) {
  try {
    const {
      id,
    } =
      await context.params;

    const result =
      await getCustomerOfferWorkflowDetail(
        id
      );

    return NextResponse.json({
      success:
        true,
      data:
        result.offer,
      stockRequirements:
        result.stockRequirements,
      message:
        result.message,
    });
  } catch (error) {
    return errorResponse(
      error
    );
  }
}

export async function POST(
  request:
    NextRequest,
  context:
    RouteContext
) {
  try {
    const {
      id,
    } =
      await context.params;

    const body:
      Partial<CustomerOfferWorkflowRequest> =
      await request.json();

    const action =
      body.action;

    if (
      !isWorkflowAction(
        action
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,
          message:
            "Geçersiz teklif iş akışı işlemi.",
        },
        {
          status:
            400,
        }
      );
    }

    const result =
      await runCustomerOfferWorkflow(
        id,
        action,
        {
          supplierSelections:
            body.supplierSelections,
          reservedStockDecisions: body.reservedStockDecisions,
          confirmUnavailableOrderProducts:
            body.confirmUnavailableOrderProducts,
          supplierPayments:
            body.supplierPayments,
          payment:
            body.payment,
        }
      );

    return NextResponse.json({
      success:
        true,
      data:
        result.offer,
      stockRequirements:
        result.stockRequirements,
      message:
        result.message,
    });
  } catch (error) {
    return errorResponse(
      error
    );
  }
}
