const { v4: uuidv4 } = require("uuid");

const { dynamoDbClient, s3Client } = require("../config/aws-config");

const {
    ScanCommand,
    GetCommand,
    PutCommand,
    DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");

const {
    PutObjectCommand,
    DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const TABLE_NAME = "BooksStore"; //sua ten bang cho dung
const BUCKET_NAME = "bookstore-bucket-s3"; //sua ten bucket cho dung
const AWS_REGION = "ap-southeast-1";


const PRIMARY_KEY = "bookId"; //sua ten khoa chinh cho dung



const IMAGE_FIELD = "coverImageUrl"; //sua ten truong anh cho dung


const buildImageUrl = (key) => {
    return `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;
};

const getS3KeyFromUrl = (url) => {
    if (!url) return null;
    return url.split("/").pop();
};

const isS3DeleteAccessDeniedError = (error) => {
    if (!error) return false;

    const code = String(error.name || error.Code || error.code || "");
    const message = String(error.message || "");

    return code === "AccessDenied" || message.includes("not authorized to perform: s3:DeleteObject");
};

const normalizeData = (body, existingItem = {}) => {
    const data = {
        ...existingItem,
        ...body,
    };

    if (data.unit_in_stock !== undefined) data.unit_in_stock = Number(data.unit_in_stock);
    if (data.price !== undefined) data.price = Number(data.price);

    return data;
};

const validateData = (data) => { //viet lai ham validateData cho dung
    const errors = [];

    if (!data.title || data.title.trim() === "") {
        errors.push("Tên sách không được để trống");
    }

    if (!data.author || data.author.trim() === "") {
        errors.push("Tên người sở hữu không được để trống");
    }

    const validCategories = ["Tiểu thuyết", "CNTT", "Kinh tế", "Thiếu nhi"];
    if (!validCategories.includes(data.category)) {
        errors.push("Category phải là Tiểu thuyết, CNTT, Kinh tế, Thiếu nhi");
    }

    if (isNaN(data.unit_in_stock) || data.unit_in_stock < 0) {
        errors.push("Số lượng tồn phải lớn hơn hoặc bằng 0");
    }

    if (isNaN(data.price) || data.price <= 0) {
        errors.push("Giá phải lớn hơn 0");
    }
    if (data.createdAt) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const inputDate = new Date(data.createdAt);
        inputDate.setHours(0, 0, 0, 0);

        if (isNaN(inputDate.getTime()) || inputDate > today) {
            errors.push("Ngày tạo không được lớn hơn ngày hiện tại");
        }
    }

    if (errors.length > 0) {
        throw new Error(errors.join(", "));
    }
};

const uploadFileToS3 = async(file) => {
    if (!file) return null;

    const key = `${Date.now()}-${file.originalname}`;

    await s3Client.send(
        new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        })
    );

    return buildImageUrl(key);
};

const deleteFileFromS3ByUrl = async(url) => {
    const key = getS3KeyFromUrl(url);
    if (!key) return;

    try {
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
            })
        );
    } catch (error) {
        if (isS3DeleteAccessDeniedError(error)) {
            console.warn(`[S3] Khong co quyen xoa file: ${key}. Bo qua buoc xoa anh tren S3.`);
            return;
        }

        throw error;
    }
};

// =========================
// CRUD
// =========================
const getAllItems = async(keyword = "") => {
    const result = await dynamoDbClient.send(
        new ScanCommand({
            TableName: TABLE_NAME,
        }),
    );

    const items = result.Items || [];
    const normalizedKeyword = keyword.trim().toLowerCase();

    if (!normalizedKeyword) {
        return items;
    }

    return items.filter((item) => {
        const title = String(item.title || "").toLowerCase();
        const author = String(item.author || "").toLowerCase();

        return title.includes(normalizedKeyword) || author.includes(normalizedKeyword);
    });
};

const getItemById = async(id) => {
    const result = await dynamoDbClient.send(
        new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                [PRIMARY_KEY]: id
            },
        })
    );

    return result.Item || null;
};

const saveItem = async(id, body, file) => {
    let existingItem = null;

    if (id) {
        existingItem = await getItemById(id);
        if (!existingItem) {
            throw new Error("Không tìm thấy dữ liệu để cập nhật");
        }
    }

    let item = normalizeData(body, existingItem || {});

    item[PRIMARY_KEY] = id || body.bookId || uuidv4();

    if (!id) {
        item.createdAt = new Date().toISOString();
    }

    item.updatedAt = new Date().toISOString();

    validateData(item);

    if (file) {
        const newImageUrl = await uploadFileToS3(file);

        if (existingItem && existingItem[IMAGE_FIELD]) {
            await deleteFileFromS3ByUrl(existingItem[IMAGE_FIELD]);
        }

        item[IMAGE_FIELD] = newImageUrl;
    } else if (existingItem && existingItem[IMAGE_FIELD]) {
        item[IMAGE_FIELD] = existingItem[IMAGE_FIELD];
    }


    await dynamoDbClient.send(
        new PutCommand({
            TableName: TABLE_NAME,
            Item: item,
        })
    );

    return item;
};

const deleteItemById = async(id) => {
    const existingItem = await getItemById(id);

    if (!existingItem) {
        throw new Error("Không tìm thấy dữ liệu để xóa");
    }

    if (existingItem[IMAGE_FIELD]) {
        await deleteFileFromS3ByUrl(existingItem[IMAGE_FIELD]);
    }

    await dynamoDbClient.send(
        new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
                [PRIMARY_KEY]: id
            },
        })
    );
};

module.exports = {
    getAllItems,
    getItemById,
    saveItem,
    deleteItemById,
};
