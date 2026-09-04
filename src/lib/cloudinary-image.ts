interface CloudinaryImageOptions {
  width?: number;

  height?: number;

  crop?:
    | "fill"
    | "fit"
    | "limit";
}

export function getCloudinaryImageUrl(
  url:
    string | undefined,
  options:
    CloudinaryImageOptions = {}
) {
  if (
    !url
  ) {
    return "";
  }

  if (
    !url.includes(
      "/upload/"
    )
  ) {
    return url;
  }

  const {
    width =
      160,

    height =
      160,

    crop =
      "fill",
  } = options;

  const transformation = [
    "f_auto",
    "q_auto",
    `c_${crop}`,
    `w_${width}`,
    `h_${height}`,
  ].join(
    ","
  );

  return url.replace(
    "/upload/",
    `/upload/${transformation}/`
  );
}